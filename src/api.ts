// API base URL:
//   - In development via Vite proxy:  falls back to "/api/v1"
//   - On Vercel / deployed:           set VITE_API_BASE_URL (e.g. "https://api.example.com/api/v1")
// Base URL of the JSON API. Exported so the health-check runner can issue
// raw requests (it needs status codes + payloads, not throwing helpers).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

// ---------- Private test-access gate ----------
// While the Rails API has TEST_ACCESS_PASSWORD configured, every request must
// carry a signed test-access token in the X-Test-Access-Token header. The
// token is exchanged for the password at /test_access (server-side check) and
// stored in sessionStorage — never the password itself, never localStorage.
export const TEST_ACCESS_TOKEN_KEY = "bvb_test_access_token";

export function getTestAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TEST_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTestAccessToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TEST_ACCESS_TOKEN_KEY, token);
    else sessionStorage.removeItem(TEST_ACCESS_TOKEN_KEY);
  } catch {
    // Storage may be unavailable (private mode); access just won't persist
    // across refreshes.
  }
}

export function clearTestAccessToken(): void {
  setTestAccessToken(null);
}

import type { DrillDefinition } from "./components/drill/definition";

// ---------- API error types ----------
/**
 * Thrown when the API responds 4xx/5xx with a `{ errors: string[] }` body
 * (Rails' standard validation-error shape). Carries the raw messages so callers
 * can map them into structured issues instead of only showing a joined string.
 */
export class ApiValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(". "));
    this.name = "ApiValidationError";
    this.errors = errors;
  }
}

// ---------- API token (bearer auth for cross-origin SPA) ----------
const TOKEN_KEY = "bvb_api_token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage may be unavailable (private mode). Auth still works for the session.
  }
}

// Raw bearer token for the health-check runner. The Authorization header is
// redacted before display.
export function getApiToken(): string | null {
  return getToken();
}

export interface HealthDetailed {
  status: string;
  service: string;
  database: string;
  environment: string;
  version: string;
  timestamp: string;
  database_details: Record<string, string | number | boolean | null>;
  server: Record<string, string | number | boolean | null>;
  endpoint: Record<string, string | number | boolean | null>;
  counts: Record<string, number>;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Private test-access gate: attach the signed token issued by
  // /test_access (no-op when absent — e.g. gate disabled).
  const testToken = getTestAccessToken();
  if (testToken) headers["X-Test-Access-Token"] = testToken;
  return headers;
}

/** Shape of the API's gate rejection body (see TestAccess concern). */
export interface TestAccessErrorBody {
  authenticated: false;
  error: string;
  code?: string;
}

function throwApiError(
  status: number,
  data: unknown,
  fallback: string,
): Error {
  if (Array.isArray((data as { errors?: string[] })?.errors)) {
    return new ApiValidationError((data as { errors: string[] }).errors);
  }
  if ((data as { error?: string })?.error) {
    const err = new Error((data as { error: string }).error) as Error & {
      status?: number;
      code?: string;
    };
    err.status = status;
    err.code = (data as { code?: string })?.code;
    return err;
  }
  const err = new Error(fallback) as Error & { status?: number };
  err.status = status;
  return err;
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && (data as TestAccessErrorBody)?.code === "test_access_required") {
      clearTestAccessToken();
      if (!window.location.pathname.startsWith("/test-access")) {
        window.location.assign("/test-access?expired=1");
      }
    }
    throw throwApiError(response.status, data, `API Error: ${response.status}`);
  }
  return response.json();
}

function normalizePaginatedResponse<T>(response: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: {
        page: 1,
        per_page: response.length,
        total: response.length,
        total_pages: 1,
      },
    };
  }
  return response;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Skill {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category_id: number;
  category?: Category;
  video_references?: VideoReference[];
}

export interface Drill {
  id: number;
  title: string;
  slug: string;
  setup_instructions: string;
  training_stage: 'warmup' | 'beginning' | 'middle' | 'end' | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  min_players: number | null;
  max_players: number | null;
  ideal_num_players: number | null;
  definition?: DrillDefinition | null;
  skills?: Skill[];
  video_references?: VideoReference[];
}

/** A reusable external video (provider + normalized identity), see README. */
export interface Video {
  id: number;
  title: string | null;
  description?: string | null;
  provider: string;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  provider_label: string;
  /** Owner of the Video row; drives who may edit/delete it in the UI. */
  created_by_id?: number | null;
  /** Videos belong to at most one category; null means "Uncategorized". */
  video_category?: VideoCategory | null;
  video_tags?: VideoTag[];
}

/** Row of GET /videos — a video plus its playback/usage summary. */
export interface VideoSummary extends Video {
  can_embed: boolean;
  embed_url: string | null;
  external_url: string;
  reference_count: number;
}

/** Video category for grouping videos in the library. */
export interface VideoCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  position: number;
  video_count?: number;
  created_at: string;
  updated_at: string;
}

/** Reusable tag for videos. */
export interface VideoTag {
  id: number;
  name: string;
  video_count?: number;
  created_at: string;
  updated_at: string;
}

/** How a Video is used by a Drill/Skill: relevance window, text, order. */
export interface VideoReference {
  id: number;
  start_seconds: number | null;
  end_seconds: number | null;
  title: string | null;
  description: string | null;
  position: number;
  can_embed: boolean;
  embed_url: string | null;
  external_url: string;
  video: Video;
}

export interface VideoReferenceInput {
  video_id?: number;
  video?: { source_url: string; title?: string; description?: string };
  start_seconds?: number | null;
  end_seconds?: number | null;
  title?: string;
  description?: string;
  position?: number;
}

/** Which resource a video reference is attached to (API path segment). */
export type VideoReferenceTarget = "drills" | "skills" | "training_sessions";

/**
 * Payload for creating/updating a standalone library Video.
 * `video_tag_ids` replaces the full tag set when present; omit it to leave the
 * tags untouched (the backend only syncs tags when the key is sent).
 */
export interface VideoInput {
  source_url?: string;
  title?: string | null;
  description?: string | null;
  video_category_id?: number | null;
  video_tag_ids?: number[];
}


export type TrainingSessionStatus = "draft" | "scheduled" | "cancelled" | "completed";

export interface TrainingFocusSkill {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category?: Category;
}

export interface TrainingFocus {
  id: number;
  skill_id: number | null;
  custom_focus: string | null;
  description: string | null;
  position: number;
  label?: string;
  skill?: TrainingFocusSkill | null;
}

export interface TrainingSessionDrillRow {
  id: number;
  drill_id: number;
  position: number;
  duration_minutes: number | null;
  notes: string | null;
  drill?: Drill;
}

export interface TrainingSession {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: TrainingSessionStatus;
  created_by_id: number | null;
  duration_minutes?: number;
  status_label?: string;
  created_by?: { id: number; name: string } | null;
  training_focuses?: TrainingFocus[];
  training_session_drills?: TrainingSessionDrillRow[];
  video_references?: VideoReference[];
}

export interface TrainingFocusInput {
  id?: number;
  skill_id?: number | null;
  custom_focus?: string | null;
  description?: string | null;
  position?: number;
  _destroy?: boolean;
}

export interface TrainingSessionDrillInput {
  id?: number;
  drill_id?: number;
  position?: number;
  duration_minutes?: number | null;
  notes?: string | null;
  _destroy?: boolean;
}

export interface TrainingSessionInput {
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  location?: string | null;
  status?: TrainingSessionStatus;
  training_focuses_attributes?: TrainingFocusInput[];
  training_session_drills_attributes?: TrainingSessionDrillInput[];
}

export interface User {
  id: number;
  name: string;
  email_address: string;
  roles: string[];
}

export interface UserWithToken extends User {
  token: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email_address: string;
  roles: { id: number; name: string }[];
}

export interface LogObject {
  type: string;
  id: number;
  label?: string | null;
  exists?: boolean;
  slug?: string | null;
}

export interface Log {
  id: number;
  description: string;
  action: string;
  method: string;
  path: string | null;
  status: number | null;
  user: { id: number; name: string; email_address: string } | null;
  objects: LogObject[];
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
}

export interface LogsMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface LogsResponse {
  data: Log[];
  meta: LogsMeta;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AccountAddress {
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface Account {
  id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: AccountAddress;
}


async function postJSON<T>(endpoint: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && (data as TestAccessErrorBody)?.code === "test_access_required") {
      clearTestAccessToken();
      if (!window.location.pathname.startsWith("/test-access")) {
        window.location.assign("/test-access?expired=1");
      }
    }
    throw throwApiError(response.status, data, `API Error: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

// ---------- Test access API (private test-access gate) ----------
export interface TestAccessResponse {
  authenticated: boolean;
  token?: string | null;
  expires_at?: string;
  disabled?: boolean;
  error?: string;
  code?: string;
}

export const testAccessApi = {
  /** Exchange the entered password for a signed test-access token. */
  submit: (password: string) =>
    postJSON<TestAccessResponse>("/test_access", { password }),
  /** Verify the stored token (used on boot to detect expiry). */
  verify: () =>
    fetchAPI<TestAccessResponse>("/test_access"),
};

export const api = {
  categories: () => fetchAPI<Category[]>("/categories"),
  skills: () => fetchAPI<Skill[]>("/skills"),
  skill: (slugOrId: string) => fetchAPI<Skill>(`/skills/${encodeURIComponent(slugOrId)}`),
  drills: () => fetchAPI<Drill[]>("/drills"),
  drill: (slugOrId: string) => fetchAPI<Drill>(`/drills/${encodeURIComponent(slugOrId)}`),
  videos: () => fetchAPI<VideoSummary[]>("/videos"),
  video: (id: number | string) =>
    fetchAPI<VideoSummary>(`/videos/${encodeURIComponent(String(id))}`),
  createVideo: (data: VideoInput) =>
    postJSON<VideoSummary>("/videos", { video: data }),
  updateVideo: (id: number | string, data: Partial<VideoInput>) =>
    postJSON<VideoSummary>(
      `/videos/${encodeURIComponent(String(id))}`,
      { video: data },
      "PATCH",
    ),
  deleteVideo: (id: number | string) =>
    postJSON<void>(`/videos/${encodeURIComponent(String(id))}`, {}, "DELETE"),
  createVideoReference: (
    target: VideoReferenceTarget,
    targetId: number,
    data: VideoReferenceInput,
  ) =>
    postJSON<VideoReference>(
      `/${target}/${targetId}/video_references`,
      { video_reference: data },
    ),
  updateVideoReference: (
    target: VideoReferenceTarget,
    targetId: number,
    id: number,
    data: VideoReferenceInput,
  ) =>
    postJSON<VideoReference>(
      `/${target}/${targetId}/video_references/${id}`,
      { video_reference: data },
      "PATCH",
    ),
  removeVideoReference: (
    target: VideoReferenceTarget,
    targetId: number,
    id: number,
  ) => postJSON<void>(`/${target}/${targetId}/video_references/${id}`, {}, "DELETE"),

  // ---------- Video categories (public read) ----------
  videoCategories: () => fetchAPI<VideoCategory[]>("/video_categories"),
  videoCategory: (id: number | string) =>
    fetchAPI<VideoCategory>(`/video_categories/${encodeURIComponent(String(id))}`),

  // ---------- Video tags (public read, optional search) ----------
  videoTags: (search?: string) => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    const query = qs.toString();
    return fetchAPI<VideoTag[]>(`/video_tags${query ? `?${query}` : ""}`);
  },
  videoTag: (id: number | string) =>
    fetchAPI<VideoTag>(`/video_tags/${encodeURIComponent(String(id))}`),
  trainingSessions: (params?: {
    starts_at_from?: string;
    starts_at_to?: string;
    status?: TrainingSessionStatus;
  }) => {
    const qs = new URLSearchParams();
    if (params?.starts_at_from) qs.set("starts_at_from", params.starts_at_from);
    if (params?.starts_at_to) qs.set("starts_at_to", params.starts_at_to);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return fetchAPI<TrainingSession[]>(
      `/training_sessions${query ? `?${query}` : ""}`
    );
  },
  trainingSession: (id: number) =>
    fetchAPI<TrainingSession>(`/training_sessions/${id}`),
  createTrainingSession: (data: TrainingSessionInput) =>
    postJSON<TrainingSession>("/training_sessions", { training_session: data }),
  updateTrainingSession: (id: number, data: Partial<TrainingSessionInput>) =>
    postJSON<TrainingSession>(
      `/training_sessions/${id}`,
      { training_session: data },
      "PATCH"
    ),
  deleteTrainingSession: (id: number) =>
    postJSON<void>(`/training_sessions/${id}`, {}, "DELETE"),


  // Admin
  adminUsers: async (params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<AdminUser[] | PaginatedResponse<AdminUser>>(`/admin/users${query ? `?${query}` : ""}`);
    return normalizePaginatedResponse(response);
  },
  adminAddRole: (userId: number, role: string) =>
    postJSON<{ roles: string[] }>(`/admin/users/${userId}/roles`, { role }),
  adminRemoveRole: (userId: number, role: string) =>
    postJSON<{ roles: string[] }>(
      `/admin/users/${userId}/roles/${encodeURIComponent(role)}`,
      {},
      "DELETE"
    ),

  // Admin Settings — Skills (admin-only endpoints, authorize_admin! on backend)
  adminSkills: async (params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<Skill[] | PaginatedResponse<Skill>>(`/admin/skills${query ? `?${query}` : ""}`);
    return normalizePaginatedResponse(response);
  },
  adminSkill: (id: string | number) =>
    fetchAPI<Skill>(`/admin/skills/${encodeURIComponent(String(id))}`),
  adminCreateSkill: (data: { title: string; category_id: number; description?: string | null }) =>
    postJSON<Skill>("/admin/skills", { skill: data }),
  adminUpdateSkill: (
    id: string | number,
    data: { title?: string; category_id?: number; description?: string | null }
  ) => postJSON<Skill>(`/admin/skills/${encodeURIComponent(String(id))}`, { skill: data }, "PATCH"),
  adminDestroySkill: (id: string | number) =>
    postJSON<void>(`/admin/skills/${encodeURIComponent(String(id))}`, {}, "DELETE"),

  // Admin Settings — Categories
  adminCategories: async (params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<Category[] | PaginatedResponse<Category>>(`/admin/categories${query ? `?${query}` : ""}`);
    return normalizePaginatedResponse(response);
  },
  adminCategory: (id: string | number) =>
    fetchAPI<Category>(`/admin/categories/${encodeURIComponent(String(id))}`),
  adminCreateCategory: (data: { name: string }) =>
    postJSON<Category>("/admin/categories", { category: data }),
  adminUpdateCategory: (id: string | number, data: { name?: string }) =>
    postJSON<Category>(
      `/admin/categories/${encodeURIComponent(String(id))}`,
      { category: data },
      "PATCH"
    ),
  adminDestroyCategory: (id: string | number, confirmDestroy = false) =>
    postJSON<void>(
      `/admin/categories/${encodeURIComponent(String(id))}${
        confirmDestroy ? `?confirm_destroy=${encodeURIComponent(String(id))}` : ""
      }`,
      {},
      "DELETE"
    ),

  // Admin — Video Categories
  adminVideoCategories: () => fetchAPI<VideoCategory[]>("/admin/video_categories"),
  adminCreateVideoCategory: (data: { name: string; description?: string | null; position?: number }) =>
    postJSON<VideoCategory>("/admin/video_categories", { video_category: data }),
  adminUpdateVideoCategory: (
    id: string | number,
    data: { name?: string; description?: string | null; position?: number }
  ) =>
    postJSON<VideoCategory>(
      `/admin/video_categories/${encodeURIComponent(String(id))}`,
      { video_category: data },
      "PATCH"
    ),
  adminDestroyVideoCategory: (id: string | number) =>
    postJSON<void>(`/admin/video_categories/${encodeURIComponent(String(id))}`, {}, "DELETE"),

  // Admin — Video Tags
  adminVideoTags: () => fetchAPI<VideoTag[]>("/admin/video_tags"),
  adminCreateVideoTag: (data: { name: string }) =>
    postJSON<VideoTag>("/admin/video_tags", { video_tag: data }),
  adminUpdateVideoTag: (id: string | number, data: { name?: string }) =>
    postJSON<VideoTag>(
      `/admin/video_tags/${encodeURIComponent(String(id))}`,
      { video_tag: data },
      "PATCH"
    ),
  adminDestroyVideoTag: (id: string | number) =>
    postJSON<void>(`/admin/video_tags/${encodeURIComponent(String(id))}`, {}, "DELETE"),

  // Admin Settings — Drills
  adminDrills: async (params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<Drill[] | PaginatedResponse<Drill>>(`/admin/drills${query ? `?${query}` : ""}`);
    return normalizePaginatedResponse(response);
  },
  adminDrill: (id: string | number) =>
    fetchAPI<Drill>(`/admin/drills/${encodeURIComponent(String(id))}`),
  adminCreateDrill: (data: {
    title: string;
    setup_instructions?: string | null;
    training_stage?: string | null;
    difficulty_level?: string | null;
    min_players?: number | null;
    max_players?: number | null;
    ideal_num_players?: number | null;
    definition?: DrillDefinition | null;
    skill_ids: number[];
  }) => postJSON<Drill>("/admin/drills", { drill: data }),
  adminUpdateDrill: (
    id: string | number,
    data: {
      title?: string;
      setup_instructions?: string | null;
      training_stage?: string | null;
      difficulty_level?: string | null;
      min_players?: number | null;
      max_players?: number | null;
      ideal_num_players?: number | null;
      definition?: DrillDefinition | null;
      skill_ids?: number[];
    }
  ) =>
    postJSON<Drill>(
      `/admin/drills/${encodeURIComponent(String(id))}`,
      { drill: data },
      "PATCH"
    ),
  adminDestroyDrill: (id: string | number) =>
    postJSON<void>(`/admin/drills/${encodeURIComponent(String(id))}`, {}, "DELETE"),


  // ---------- Admin "Act as User" impersonation ----------
  startImpersonation: (userId: number) =>
    postJSON<{
      impersonating: boolean;
      effective_user: { id: number; name: string; email_address: string; roles: string[] } | null;
      real_admin: { id: number; name: string; email_address: string };
    }>("/admin/impersonations", { user_id: userId }),
  stopImpersonation: () =>
    postJSON<{
      impersonating: boolean;
      effective_user: { id: number; name: string; email_address: string; roles: string[] } | null;
      real_admin: { id: number; name: string; email_address: string };
    }>("/admin/impersonations", {}, "DELETE"),

  // ---------- Health diagnostics (admin) ----------
health: () => fetchAPI<{ status: string }>("/health"),
healthDetailed: () => fetchAPI<HealthDetailed>("/health/detailed"),


  me: () => fetchAPI<User | null>("/me"),
  login: (email_address: string, password: string) =>
    postJSON<UserWithToken>("/sessions", { email_address, password, api: true })
      .then((data) => {
        if (data.token) setToken(data.token);
        return data;
      }),
  logout: () => {
    const request = postJSON<void>("/sessions", {}, "DELETE");
    setToken(null);
    return request;
  },
  register: (name: string, email_address: string, password: string, password_confirmation: string) =>
    postJSON<UserWithToken>("/registrations", {
      user: { name, email_address, password, password_confirmation },
      api: true,
    }).then((data) => {
      if (data.token) setToken(data.token);
      return data;
    }),
  requestPasswordReset: (email_address: string) =>
    postJSON<void>("/passwords", { email_address }),
  resetPassword: (token: string, password: string, password_confirmation: string) =>
    postJSON<UserWithToken>(`/passwords/${encodeURIComponent(token)}`, {
      password,
      password_confirmation,
      api: true,
    }).then((data) => {
      if (data.token) setToken(data.token);
      return data;
    }),

  // Admin audit logs (read-only)
  adminLogs: (params: {
    page?: number;
    per_page?: number;
    action?: string;
    action_filter?: string;
    user_id?: string;
    object_type?: string;
    object_id?: string;
    request_id?: string;
    date_from?: string;
    date_to?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const query = qs.toString();
    return fetchAPI<LogsResponse>(`/admin/logs${query ? `?${query}` : ""}`);
  },
  adminLog: (id: number | string) => fetchAPI<{ data: Log }>(`/admin/logs/${id}`),

  // Rails log file tail (read-only)
  adminSystemLogs: (lines: number = 500) =>
    fetchAPI<{ lines: string[] }>(`/admin/system_logs?lines=${lines}`),

  // Account
  account: (): Promise<Account> => fetchAPI<Account>("/account"),
  updateAccount: (data: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    date_of_birth: string | null;
    address: {
      street_address: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    };
  }): Promise<Account> =>
    postJSON<Account>("/account", data, "PATCH"),
  updatePassword: (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> =>
    postJSON<{ message: string }>("/account/password", data, "PATCH"),
};
