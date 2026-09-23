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
  /** Present on list payloads: true when a renderable visual definition exists. */
  has_definition?: boolean;
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
    /** Admin-curated drag-and-drop order (app-managed, never edited directly).
   *  Optional on the frontend type: the API always returns it for persisted
   *  records, but mock/test fixtures and in-flight objects may omit it.
   */
  position?: number;
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

/**
 * Who may see a training session. `shared` is the normal case: the session is
 * part of the published schedule. `private` narrows it to the people who run
 * trainings (coaches/curators/admins) — used for one-to-one work, rehab blocks
 * and anything that should not appear in a player's calendar.
 */
export type TrainingSessionVisibility = "shared" | "private";

/**
 * Where a participant stands. The backend keeps the state machine
 * (`invited → confirmed → attended|absent`, with `declined` as the opt-out), so
 * the UI only labels and colours these values.
 */
export type ParticipantStatus =
  | "invited"
  | "confirmed"
  | "declined"
  | "attended"
  | "absent";

/** Person fields exposed on a serialized participant. */
export interface ParticipantPerson {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface ParticipantPlayerProfile {
  id: number;
  preferred_position: string | null;
  level: string | null;
  person?: ParticipantPerson;
}

export interface TrainingSessionParticipant {
  id: number;
  player_profile_id: number;
  status: ParticipantStatus;
  notes: string | null;
  /** Server-computed display name (present on serialized rows). */
  player_name?: string;
  /** true when the player has an Account, false for a staff-recorded profile. */
  account_connected?: boolean;
  player_profile?: ParticipantPlayerProfile;
}

/**
 * A participant row submitted with a training session (nested attributes).
 *
 * Either `player_profile_id` names an existing player, or `person` records a
 * player who has no account yet — the server then creates Person +
 * PlayerProfile (creation_source: "coach_created") and links them, without an
 * Account. `_destroy` removes a row.
 */
export interface TrainingSessionParticipantInput {
  id?: number;
  player_profile_id?: number;
  status?: ParticipantStatus;
  notes?: string | null;
  _destroy?: boolean;
  person?: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
  };
}

export interface TrainingSession {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: TrainingSessionStatus;
  visibility: TrainingSessionVisibility;
  created_by_id: number | null;
  duration_minutes?: number;
  status_label?: string;
  created_by?: { id: number; name: string } | null;
  training_focuses?: TrainingFocus[];
  training_session_drills?: TrainingSessionDrillRow[];
  training_session_participants?: TrainingSessionParticipant[];
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
  visibility?: TrainingSessionVisibility;
  training_focuses_attributes?: TrainingFocusInput[];
  training_session_drills_attributes?: TrainingSessionDrillInput[];
  training_session_participants_attributes?: TrainingSessionParticipantInput[];
}

// ---------- People, players and coaches (identity model) ----------
/**
 * Whether a person can authenticate. "connected" = the person has an Account
 * (they signed up / were invited and accepted); "profile_only" = staff recorded
 * them so they could be scheduled, without any Account or permissions.
 */
export type AccountStatus = "connected" | "profile_only";

export type ProfileStatus = "active" | "inactive" | "archived";

/**
 * How a Person came to exist. Provenance is what lets the system tell a
 * self-signup from a staff-recorded profile — claiming and duplicate
 * resolution both branch on it.
 */
export type CreationSource = "signup" | "coach_created" | "player_created" | "system";

/**
 * Compact identity payload: returned by the people search (`GET /api/v1/people`)
 * and inside `possible_duplicates` on player/coach creation, so both render
 * with the same component.
 */
export interface PersonIdentity {
  id: number;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  creation_source: CreationSource | string;
  account_status: AccountStatus;
  /** Set when the person is already a player / coach — no second profile needed. */
  player_profile_id: number | null;
  coach_profile_id: number | null;
  /**
   * Alternate names (nicknames, previous names after a rename). Not identity
   * evidence, but how a coach usually recognises someone.
   */
  aliases?: string[];
}

export interface ProfilePerson {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  creation_source: CreationSource | string;
}

export interface Player {
  id: number;
  person_id: number;
  preferred_position: string | null;
  level: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  full_name?: string;
  account_status?: AccountStatus;
  player_profile_id?: number;
  training_session_count?: number;
  person: ProfilePerson;
  /** Only on show: the sessions this player is attached to. */
  training_session_participants?: {
    id: number;
    status: ParticipantStatus;
    notes: string | null;
    created_at: string;
    training_session?: {
      id: number;
      title: string;
      starts_at: string;
      ends_at: string;
      location: string | null;
      status: TrainingSessionStatus;
      visibility: TrainingSessionVisibility;
    };
  }[];
}

/**
 * Create payload. Name the human either way:
 *   * `person_id` — link a profile to a person that already exists (the result
 *     of a people search);
 *   * `person`    — record a new person, with no Account (coach_created).
 */
export interface PlayerInput {
  person_id?: number;
  person?: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
  };
  player_profile?: {
    preferred_position?: string | null;
    level?: string | null;
    status?: ProfileStatus;
  };
}

export interface Coach {
  id: number;
  person_id: number;
  coaching_level: string | null;
  qualifications: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  full_name?: string;
  account_status?: AccountStatus;
  coach_profile_id?: number;
  person: ProfilePerson;
}

export interface CoachInput {
  person_id?: number;
  person?: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
  };
  coach_profile?: {
    coaching_level?: string | null;
    qualifications?: string | null;
    status?: ProfileStatus;
  };
}

/**
 * Creation response: the stored profile plus the people who may already
 * describe the same human. Suggestions only — nothing is ever merged
 * automatically, a coach decides.
 */
export interface PlayerCreateResponse extends Player {
  possible_duplicates: PersonIdentity[];
}

export interface CoachCreateResponse extends Coach {
  possible_duplicates: PersonIdentity[];
}

export interface User {
  id: number;
  name: string;
  email_address: string;
  roles: string[];
}

export interface UserWithToken extends User {
  token?: string;
  /** Present when the account still needs email verification (no session). */
  status?: "pending_verification";
  verification_token?: string;
  email?: string;
  message?: string;
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

/**
 * Global runtime configuration (admin-only), persisted in the backend's
 * app_settings table. Mirrors the wine words project's Configuration page:
 *   logs_saved_to_database — master switch for audit-log persistence
 *                            (maps to the "logs_enabled" key)
 *   test                   — when true, every outgoing email is redirected to
 *                            test_email with a [TEST] subject prefix
 *   test_email             — recipient address for test-mode redirection
 *                            (default: romalopes@yahoo.com.br)
 */
export interface AppConfiguration {
  logs_saved_to_database: boolean;
  test: boolean;
  test_email: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
  built_in: boolean;
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
    /** mine=true narrows the calendar to the current player's own sessions. */
    mine?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.starts_at_from) qs.set("starts_at_from", params.starts_at_from);
    if (params?.starts_at_to) qs.set("starts_at_to", params.starts_at_to);
    if (params?.status) qs.set("status", params.status);
    if (params?.mine) qs.set("mine", "1");
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

  // ---------- People search (identity lookup, staff only) ----------
  /**
   * "Has this human already been recorded?" — the lookup the create-player /
   * create-coach flow runs before recording a new person, so a coach can pick
   * an existing identity instead of duplicating it.
   */
  people: (params?: { q?: string; email?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    const query = qs.toString();
    return fetchAPI<PersonIdentity[]>(`/people${query ? `?${query}` : ""}`);
  },

  // ---------- Players (read: training managers; create: coach/admin) ----------
  /**
   * Paginated catalogue (`{ data, meta }`, 20 per page by default).
   * The training form's player picker asks for a `per_page` big enough to hold
   * the whole roster, so it can filter locally while a coach types.
   */
  players: async (params?: {
    q?: string;
    email?: string;
    status?: ProfileStatus;
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<Player[] | PaginatedResponse<Player>>(
      `/players${query ? `?${query}` : ""}`,
    );
    return normalizePaginatedResponse(response);
  },
  player: (id: number) => fetchAPI<Player>(`/players/${id}`),
  createPlayer: (data: PlayerInput) =>
    postJSON<PlayerCreateResponse>("/players", { player: data }),
  /**
   * Correct a player's own attributes or the person's contact details. The
   * response carries `possible_duplicates` again: a correction is exactly when
   * a duplicate shows up. `person_id` is rejected by the API — re-pointing a
   * profile is a merge, not an edit.
   */
  updatePlayer: (id: number, data: PlayerInput) =>
    postJSON<PlayerCreateResponse>(`/players/${id}`, { player: data }, "PATCH"),

  // ---------- Coaches (read: training managers; create: coach/admin) ----------
  /** Paginated catalogue — see `players`. */
  coaches: async (params?: {
    q?: string;
    email?: string;
    status?: ProfileStatus;
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    const response = await fetchAPI<Coach[] | PaginatedResponse<Coach>>(
      `/coaches${query ? `?${query}` : ""}`,
    );
    return normalizePaginatedResponse(response);
  },
  coach: (id: number) => fetchAPI<Coach>(`/coaches/${id}`),
  createCoach: (data: CoachInput) =>
    postJSON<CoachCreateResponse>("/coaches", { coach: data }),
  /** See `updatePlayer` — same contract, same rules. */
  updateCoach: (id: number, data: CoachInput) =>
    postJSON<CoachCreateResponse>(`/coaches/${id}`, { coach: data }, "PATCH"),


  // Admin
  adminUsers: async (params?: { page?: number; per_page?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.search) qs.set("search", params.search);
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
  adminCreateVideoCategory: (data: { name: string; description?: string | null }) =>
    postJSON<VideoCategory>("/admin/video_categories", { video_category: data }),
  adminUpdateVideoCategory: (
    id: string | number,
    data: { name?: string; description?: string | null }
  ) =>
    postJSON<VideoCategory>(
      `/admin/video_categories/${encodeURIComponent(String(id))}`,
      { video_category: data },
      "PATCH"
    ),
  adminDestroyVideoCategory: (id: string | number) =>
    postJSON<void>(`/admin/video_categories/${encodeURIComponent(String(id))}`, {}, "DELETE"),
  /** Persists the drag-and-drop order; `ids` must list every category once. */
  adminReorderVideoCategories: (ids: number[]) =>
    postJSON<VideoCategory[]>("/admin/video_categories/reorder", { ids }, "PATCH"),

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
  /** Persists the drag-and-drop order; `ids` must list every tag once. */
  adminReorderVideoTags: (ids: number[]) =>
    postJSON<VideoTag[]>("/admin/video_tags/reorder", { ids }, "PATCH"),

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
        // A "pending_verification" response (HTTP 202) carries a one-time
        // email-verification token, NOT a session token. Storing it would
        // poison the bearer token and 401 every later request — only store
        // genuine session tokens.
        if (data.status === "pending_verification") return data;
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
      // Same guard as login: never persist a verification token as a session.
      if (data.status === "pending_verification") return data;
      if (data.token) setToken(data.token);
      return data;
    }),
  resendVerification: (email_address: string) =>
    postJSON<{ status: string; message?: string }>(
      "/email-verifications/resend",
      { email_address },
    ),
  verifyEmail: (token: string) =>
    fetchAPI<{ status: string; email_address: string; name: string }>(
      `/email-verifications/${encodeURIComponent(token)}`,
    ),
  requestPasswordReset: (email_address: string) =>
    postJSON<void>("/passwords", { email_address }),
  resetPassword: (token: string, password: string, password_confirmation: string) =>
        postJSON<UserWithToken>(`/passwords/${encodeURIComponent(token)}`, {
      password,
      password_confirmation,
      api: true,
    }, "PUT").then((data) => {
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

  // Global configuration (admin-only): runtime settings persisted in the
  // backend's app_settings table — log persistence toggle plus test-mode
  // email redirection. Mirrors the wine words project's Configuration page.
  getConfiguration: () => fetchAPI<AppConfiguration>("/admin/configuration"),
  updateConfiguration: (data: Partial<AppConfiguration>) =>
    postJSON<AppConfiguration>("/admin/configuration", data, "PATCH"),

  // Generic app_settings rows (admin-only key/value pairs) for the
  // Configuration page's custom-settings table.
  appSettings: () => fetchAPI<{ settings: AppSettingRow[] }>("/admin/app_settings"),
  createAppSetting: (data: { key: string; value: string }) =>
    postJSON<AppSettingRow>("/admin/app_settings", data),
  updateAppSetting: (key: string, value: string) =>
    postJSON<AppSettingRow>(`/admin/app_settings/${encodeURIComponent(key)}`, { value }, "PATCH"),
  deleteAppSetting: (key: string) =>
    postJSON<void>(`/admin/app_settings/${encodeURIComponent(key)}`, {}, "DELETE"),

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
