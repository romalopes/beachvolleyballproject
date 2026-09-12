import { API_BASE_URL } from "../../api";
import {
  DEFAULT_THRESHOLDS,
  type ApiCheck,
  type CheckResult,
  type LatencyThresholds,
} from "./apiHealthConfig";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));


// Whether an error is worth a single retry (network drop or timeout).
function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true; // "Failed to fetch" (network/CORS/DNS)
  return false;
}

function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "Timeout";
  if (err instanceof TypeError) return "Network / CORS / DNS Unreachable";
  if (err instanceof Error) return err.message;
  return String(err);
}

// Convert a latency measurement (ms) into a human rating.
export function rateLatency(
  latencyMs: number,
  thresholds: LatencyThresholds = DEFAULT_THRESHOLDS
): string {
  if (latencyMs <= thresholds.excellent) return "excellent";
  if (latencyMs <= thresholds.good) return "good";
  if (latencyMs <= thresholds.slow) return "slow";
  return "very_slow";
}

// Redact sensitive header values for display/logging.
function redactHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    out[key] = /authorization/i.test(key) ? "Bearer [REDACTED]" : value;
  });
  return out;
}

interface AttemptResult {
  response: Response;
  payload: unknown;
  headers: Record<string, string>;
}

// Perform a single HTTP request for a check, with timeout + one retry.
async function attemptRequest(
  check: ApiCheck,
  opts: { getAuthToken?: () => string | null; timeoutMs?: number }
): Promise<AttemptResult> {
  const timeout = check.timeoutMs || opts.timeoutMs || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (check.requiresAuth && opts.getAuthToken) {
    const token = opts.getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${check.url}`, {
      method: check.method,
      headers,
      credentials: "same-origin",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson
      ? await response.json().catch(() => ({}))
      : await response.text();
    return { response, payload, headers };
  } finally {
    clearTimeout(timer);
  }
}

// Execute a single check and return the standardized result object.
export async function runCheck(
  check: ApiCheck,
  opts: { getAuthToken?: () => string | null; timeoutMs?: number } = {}
): Promise<CheckResult> {
  const start = performance.now();
  let result: AttemptResult | null = null;
  let error: unknown = null;
  let retried = false;

  try {
    result = await attemptRequest(check, opts);
  } catch (err) {
    error = err;
    if (isRetryableError(err)) {
      await sleep(300);
      retried = true;
      try {
        result = await attemptRequest(check, opts);
        error = null;
      } catch (err2) {
        error = err2;
      }
    }
  }

  const latencyMs = Math.round(performance.now() - start);
  const status = result?.response?.status ?? null;
  const payload = result?.payload ?? null;

  let passed = false;
  let validationError: string | null = null;
  if (result && status === check.expectedStatus) {
    try {
      passed = check.validate ? check.validate(payload) : true;
      if (!passed) {
        validationError =
          (typeof check.describeFailure === "function" &&
            check.describeFailure(payload)) ||
          "Payload validation failed";
      }
    } catch (e) {
      passed = false;
      validationError = `Validation threw: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else if (result) {
    validationError = `Expected status ${check.expectedStatus}, got ${status}`;
  }

  return {
    id: check.id,
    name: check.name,
    category: check.category,
    passed,
    status,
    expectedStatus: check.expectedStatus,
    latencyMs,
    latencyRating: rateLatency(
      latencyMs,
      check.latencyThresholds || DEFAULT_THRESHOLDS
    ),
    payload,
    requestHeaders: redactHeaders(result?.headers || {}),
    error: error ? classifyError(error) : validationError,
    retried,
  };
}


// Write-sandbox flow: create a temporary category, then delete it.
// Returns a result object describing the whole flow.
export async function runWriteFlow(
  check: ApiCheck,
  opts: { getAuthToken?: () => string | null; timeoutMs?: number } = {}
): Promise<CheckResult> {
  const start = performance.now();
  const timeout = check.timeoutMs || opts.timeoutMs || 5000;
  const suffix = Date.now();
  const categoryName = `Health Check Temp ${suffix}`;
  const createBody = JSON.stringify({ category: { name: categoryName } });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (opts.getAuthToken) {
    const token = opts.getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let createdId: number | string | null = null;
  // Assigned for the payload record and used via the cleanup target below.
  let createdSlug: string | null = null; // eslint-disable-line no-useless-assignment
  let createStatus: number | null = null;
  let error: string | null = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const createRes = await fetch(`${API_BASE_URL}${check.url}`, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: createBody,
      signal: controller.signal,
    });
    createStatus = createRes.status;
    const createPayload = (await createRes.json().catch(() => ({}))) as {
      id?: number | string;
      slug?: string;
    };
    createdId = createPayload?.id ?? null;
    createdSlug = createPayload?.slug ?? null;

    if (createRes.status === 201 && (createdId || createdSlug)) {
      const target = createdSlug ?? createdId;
      const deleteRes = await fetch(
        `${API_BASE_URL}${check.url}/${encodeURIComponent(String(target))}`,
        {
          method: "DELETE",
          headers,
          credentials: "same-origin",
          signal: controller.signal,
        }
      );
      if (deleteRes.status !== 204) {
        error = `Cleanup DELETE returned ${deleteRes.status}`;
      }
    } else {
      error = `Create returned ${createRes.status}`;
    }
  } catch (err) {
    error = classifyError(err);
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Math.round(performance.now() - start);

  return {
    id: check.id,
    name: check.name,
    category: check.category,
    passed: !error && createStatus === 201,
    status: createStatus,
    expectedStatus: 201,
    latencyMs,
    latencyRating: rateLatency(latencyMs, check.latencyThresholds),
    payload: { createdCategoryId: createdId, tempName: categoryName },
    requestHeaders: redactHeaders(headers),
    error,
    retried: false,
  };
}

