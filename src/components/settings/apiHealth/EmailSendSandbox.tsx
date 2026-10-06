import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../api";
import type {
  ApiCheck,
  CheckResult,
} from "../../../services/apiHealth/apiHealthConfig";
import ResponseInspector from "./ResponseInspector";

// Manual send-test-email space on the API health page. Mirrors the Rails
// POST /api/v1/health/email/test contract: { to, content } in, the
// configured/effective MAIL_TRANSPORT out, with the effective name embedded
// in the delivered message's subject and body.
export default function EmailSendSandbox({
  check,
  result,
  running,
  getAuthToken,
  onRun,
}: {
  check: ApiCheck;
  result: CheckResult | undefined;
  running: boolean | undefined;
  getAuthToken: () => string | null;
  onRun: (input: { to: string; content: string }) => Promise<unknown>;
}) {
  const [to, setTo] = useState("");
  const [content, setContent] = useState("");
  const [configured, setConfigured] = useState<string | null>(null);
  const [effective, setEffective] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTransport() {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE_URL}/health/email/transport`, {
          headers,
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          configured_transport?: unknown;
          effective_transport?: unknown;
        };
        if (cancelled) return;
        if (typeof data.configured_transport === "string")
          setConfigured(data.configured_transport);
        if (typeof data.effective_transport === "string")
          setEffective(data.effective_transport);
      } catch {
        // Transport metadata is informational; the send result shows it anyway.
      }
    }
    loadTransport();
    return () => {
      cancelled = true;
    };
  }, [getAuthToken]);

  const resultPayload = result?.payload as
    | {
        configured_transport?: unknown;
        effective_transport?: unknown;
        status?: unknown;
        message?: unknown;
      }
    | undefined;
  const resultEffective =
    typeof resultPayload?.effective_transport === "string"
      ? resultPayload.effective_transport
      : null;
  const resultConfigured =
    typeof resultPayload?.configured_transport === "string"
      ? resultPayload.configured_transport
      : null;
  const resultMessage =
    typeof resultPayload?.message === "string" ? resultPayload.message : null;

  async function handleSend() {
    setLocalError(null);
    const trimmedTo = to.trim();
    const trimmedContent = content.trim();
    if (!trimmedTo) {
      setLocalError("Enter a recipient address in the TO box.");
      return;
    }
    if (!trimmedContent) {
      setLocalError("Enter the email content before sending.");
      return;
    }
    setSending(true);
    try {
      await onRun({ to: trimmedTo, content: trimmedContent });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "The request failed to send."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="health-email-sandbox">
      <h3 className="health-write-title">Send Test Email</h3>
      <p className="health-write-desc">
        {check.description ||
          "Sends a one-off test email whose subject and body embed the effectively used MAIL_TRANSPORT."}
      </p>

      <div className="health-email-transport">
        <span className="health-email-transport-key">
          Configured MAIL_TRANSPORT
        </span>
        <span className="health-email-transport-value health-badge health-neutral">
          {resultConfigured ?? configured ?? "—"}
        </span>
        <span className="health-email-transport-key">Effective transport</span>
        <span className="health-email-transport-value health-badge health-neutral">
          {resultEffective ?? effective ?? "—"}
        </span>
      </div>

      <label className="health-email-label" htmlFor="health-email-to">
        TO
      </label>
      <input
        id="health-email-to"
        className="health-email-input"
        type="email"
        autoComplete="email"
        placeholder="ops@example.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={running || sending}
      />

      <label className="health-email-label" htmlFor="health-email-content">
        Content
      </label>
      <textarea
        id="health-email-content"
        className="health-email-textarea"
        placeholder="Body of the test email…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={running || sending}
        rows={4}
      />

      <button
        type="button"
        className="admin-btn health-btn"
        disabled={running || sending}
        onClick={() => void handleSend()}
      >
        {sending ? "Sending…" : "Send"}
      </button>

      {localError && (
        <p className="health-email-error" role="alert">
          {localError}
        </p>
      )}

      {result && (
        <div style={{ marginTop: "0.9rem" }}>
          <span
            className={`health-badge ${result.passed ? "health-pass" : "health-fail"}`}
          >
            {result.passed ? "PASS" : "FAIL"}
          </span>
          <span className="health-status-text" style={{ marginLeft: "0.5rem" }}>
            {result.error ||
              resultMessage ||
              `Sent via ${resultEffective ?? resultConfigured ?? "unknown transport"} in ${result.latencyMs}ms`}
          </span>
          <div style={{ marginTop: "0.6rem" }}>
            <ResponseInspector check={check} result={result} />
          </div>
        </div>
      )}
    </div>
  );
}
