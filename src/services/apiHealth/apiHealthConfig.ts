import { BACK_END_VERSION } from "../../constants/versions";
import {
  hasStatusOk,
  isAuthMePayload,
  isCategoryPayload,
  isDrillListPayload,
  isHealthyDetailedPayload,
  isSkillListPayload,
  isTrainingSessionListPayload,
  isMediaAssetListPayload,
  isAccountPayload,
  isValidArray,
} from "./apiHealthValidators";

export const API_CATEGORIES = {
  SYSTEM: "System",
  AUTH: "Authentication",
  SECURITY: "Security Guards",
  CATEGORIES: "Categories",
  SKILLS: "Skills",
  DRILLS: "Drills",
  TRAINING: "Training & Media",
  WRITE_SANDBOX: "Write Operations (Manual)",
} as const;
export interface LatencyThresholds {
  excellent: number;
  good: number;
  slow: number;
}

export interface ApiCheck {
  id: string;
  category: string;
  name: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  expectedStatus: number;
  requiresAuth: boolean;
  // Send the request with credentials: "omit" so the browser does not attach
  // session cookies. Used by "expect 401" guard checks — the health runner runs
  // inside an authenticated cookie session, so without this a request would
  // authenticate via the cookie and return 200 instead of the expected 401.
  omitCredentials?: boolean;
  requiresManualTrigger?: boolean;
  description?: string;
  timeoutMs?: number;
  latencyThresholds?: LatencyThresholds;
  validate?: (data: unknown) => boolean;
  describeFailure?: (data: unknown) => string;
}

export interface CheckResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  status: number | null;
  expectedStatus: number;
  latencyMs: number;
  latencyRating: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  requestHeaders: Record<string, string>;
  error: string | null;
  retried: boolean;
}

export const DEFAULT_THRESHOLDS: LatencyThresholds = {
  excellent: 200,
  good: 500,
  slow: 1000,
};

// Factory for the repetitive public list-style checks. Fills in the common
// defaults (GET, expect 200, no auth, plain array validation) and lets each
// check override anything else (e.g. latency thresholds or a custom validator).
const listCheck = (check: {
  id: string;
  category: string;
  name: string;
  url: string;
  validate?: (data: unknown) => boolean;
  describeFailure?: (data: unknown) => string;
  latencyThresholds?: LatencyThresholds;
}): ApiCheck => ({
  method: "GET",
  expectedStatus: 200,
  requiresAuth: false,
  ...check,
});

export const API_CHECKS: ApiCheck[] = [
  {
    id: "system-liveness",
    category: API_CATEGORIES.SYSTEM,
    name: "Public Liveness Check",
    method: "GET",
    url: "/health",
    expectedStatus: 200,
    requiresAuth: false,
    validate: hasStatusOk,
  },
  {
    id: "system-detailed",
    category: API_CATEGORIES.SYSTEM,
    name: "Detailed Infrastructure Health",
    method: "GET",
    url: "/health/detailed",
    expectedStatus: 200,
    requiresAuth: true,
    validate: isHealthyDetailedPayload,
  },
  {
    id: "system-version-match",
    category: API_CATEGORIES.SYSTEM,
    name: "Backend Version Matches Frontend Constant",
    method: "GET",
    url: "/health/detailed",
    expectedStatus: 200,
    requiresAuth: true,
    validate: (data) =>
      (data as { version?: string } | null)?.version === BACK_END_VERSION,
    describeFailure: (data) =>
      `Backend version "${(data as { version?: string } | null)?.version ?? "unknown"}" does not match frontend BACK_END_VERSION "${BACK_END_VERSION}"`,
  },
  {
    id: "auth-me-valid",
    category: API_CATEGORIES.AUTH,
    name: "Authenticated Session Context",
    method: "GET",
    url: "/me",
    expectedStatus: 200,
    requiresAuth: true,
    validate: isAuthMePayload,
  },
  {
    id: "auth-account",
    category: API_CATEGORIES.AUTH,
    name: "Account Payload Shape",
    method: "GET",
    url: "/account",
    expectedStatus: 200,
    requiresAuth: true,
    validate: isAccountPayload,
  },
  {
    id: "security-me-rejected",
    category: API_CATEGORIES.SECURITY,
    name: "Unauthenticated /me Rejection",
    method: "GET",
    url: "/me",
    expectedStatus: 401,
    requiresAuth: false,
    omitCredentials: true,
    validate: () => true,
  },
  {
    id: "security-detailed-rejected",
    category: API_CATEGORIES.SECURITY,
    name: "Unauthenticated /health/detailed Rejection",
    method: "GET",
    url: "/health/detailed",
    expectedStatus: 401,
    requiresAuth: false,
    omitCredentials: true,
    validate: () => true,
  },
  {
    id: "security-admin-skills-rejected",
    category: API_CATEGORIES.SECURITY,
    name: "Unauthenticated /admin/skills Rejection",
    method: "GET",
    url: "/admin/skills",
    expectedStatus: 401,
    requiresAuth: false,
    omitCredentials: true,
    validate: () => true,
  },
  listCheck({
    id: "categories-list",
    category: API_CATEGORIES.CATEGORIES,
    name: "Categories List",
    url: "/categories",
    validate: (data) =>
      isValidArray(data) && (data as unknown[]).every(isCategoryPayload),
    describeFailure: () => "Expected an array of { id, name, slug } categories",
  }),
  listCheck({
    id: "skills-list",
    category: API_CATEGORIES.SKILLS,
    name: "Skills List (with categories)",
    url: "/skills",
    validate: isSkillListPayload,
    describeFailure: () =>
      "Expected an array of { id, title, slug, category_id, category } skills",
  }),
  listCheck({
    id: "drills-list",
    category: API_CATEGORIES.DRILLS,
    name: "Drills List (definition excluded)",
    url: "/drills",
    latencyThresholds: { excellent: 300, good: 700, slow: 1500 },
    validate: isDrillListPayload,
    describeFailure: () =>
      "Expected an array of drills with { id, title, slug, skills } and no raw definition column",
  }),
  listCheck({
    id: "drill-skills-list",
    category: API_CATEGORIES.DRILLS,
    name: "Drill/Skill Links",
    url: "/drill_skills",
    validate: (data) =>
      isValidArray(data) &&
      (data as unknown[]).every(
        (l) =>
          typeof (l as { drill_id?: unknown })?.drill_id === "number" &&
          typeof (l as { skill_id?: unknown })?.skill_id === "number"
      ),
    describeFailure: () => "Expected an array of { drill_id, skill_id } links",
  }),
  listCheck({
    id: "training-sessions-list",
    category: API_CATEGORIES.TRAINING,
    name: "Training Sessions List",
    url: "/training_sessions",
    validate: isTrainingSessionListPayload,
    describeFailure: () =>
      "Expected an array of { id, drill_id, scheduled_at } sessions",
  }),
  listCheck({
    id: "media-assets-list",
    category: API_CATEGORIES.TRAINING,
    name: "Media Assets List",
    url: "/media_assets",
    validate: isMediaAssetListPayload,
    describeFailure: () =>
      "Expected an array of { id, drill_id, title, video_url } media assets",
  }),
  {
    id: "write-category-create-delete",
    category: API_CATEGORIES.WRITE_SANDBOX,
    name: "Create + Delete a Temporary Category",
    method: "POST",
    url: "/categories",
    expectedStatus: 201,
    requiresAuth: false,
    requiresManualTrigger: true,
    description:
      "Creates a temporary category (name suffixed with a timestamp) then deletes it. Self-cleaning.",
    validate: isCategoryPayload,
  },
];

// A tiny helper to keep the config self-documenting.
export const isWriteCheck = (check: ApiCheck): boolean =>
  check.requiresManualTrigger === true ||
  check.category === API_CATEGORIES.WRITE_SANDBOX;

export const getCheckById = (id: string): ApiCheck | undefined =>
  API_CHECKS.find((c) => c.id === id);

