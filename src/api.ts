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
      blockers?: string[];
    };
    err.status = status;
    err.code = (data as { code?: string })?.code;
    const blockers = (data as { blockers?: unknown })?.blockers;
    if (Array.isArray(blockers) && blockers.every((item) => typeof item === "string")) {
      err.blockers = blockers;
    }
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


export interface CategoryCustom {
  id: number;
  name: string;
  visibility: "shared" | "private";
  created_by?: { id: number; name: string } | null;
}

export type AssessmentDefinitionStatus = "draft" | "active" | "archived";
export type AssessmentCategorySource = "category" | "custom_category";

export interface AssessmentCategory {
  id: number;
  category_id: number | null;
  category_custom_id: number | null;
  source_type: AssessmentCategorySource;
  label: string;
  weight: number;
  position: number;
  category?: Category | null;
  category_custom?: { id: number; name: string; visibility: string } | null;
}

export interface AssessmentDefinition {
  id: number;
  name: string;
  description: string | null;
  status: AssessmentDefinitionStatus;
  created_by_id: number | null;
  created_by?: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
  total_weight: number;
  remaining_weight: number;
  weights_balanced: boolean;
  /** A recorded result quotes this configuration, so it is frozen (D7). */
  referenced: boolean;
  /**
   * What points at this definition. Wider than `referenced`: a session or ranking
   * can quote a definition with no results recorded, and that still blocks a hard
   * delete. Counts are absent on older payloads, hence the partials.
   */
  usage_counts?: {
    assessments: number;
    assessment_sessions: number;
    ranking_consolidations: number;
  };
  in_use?: boolean;
  /** Whether a hard delete would be accepted. Gates the delete button. */
  deletable?: boolean;
  /** Human-readable blockers, e.g. "2 assessment session(s)". */
  usage_summary?: string;
  archivable?: boolean;
  restorable?: boolean;
  assessment_categories: AssessmentCategory[];
}

export interface AssessmentDefinitionInput {
  name: string;
  description?: string | null;
  status: AssessmentDefinitionStatus;
  assessment_categories_attributes: Array<{
    id?: number;
    category_id?: number | null;
    category_custom_id?: number | null;
    weight: number;
    position: number;
    _destroy?: boolean;
  }>;
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
  /** Published and stakeholder-visible assessments recorded during this session. */
  assessments?: Assessment[];
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
export type AssessmentStatus = "draft" | "active" | "withdrawn";
export type AssessmentScale = "one_to_five" | "one_to_ten" | "one_to_hundred";

export interface AssessmentCategoryScore {
  id: number;
  assessment_category_id: number;
  label: string;
  source_type: "category" | "custom_category";
  weight: number;
  score: number | null;
  reported_value: number | null;
  scale: AssessmentScale;
  score_label: string;
  ten_scale: number | null;
  five_scale: number | null;
  notes: string | null;
}

export interface Assessment {
  id: number;
  player_profile_id: number;
  coach_profile_id: number;
  assessment_definition_id?: number | null;
  assessment_definition?: AssessmentDefinition | null;
  assessment_category_scores?: AssessmentCategoryScore[];
  category_scores?: AssessmentCategoryScore[];
  category_id: number | null;
  custom_category: string | null;
  training_session_id: number | null;
  score: number | null;
  reported_value: number | null;
  scale?: AssessmentScale | null;
  notes: string | null;
  status: AssessmentStatus;
  created_at: string;
  updated_at: string;
  category_label: string;
  ten_scale: number | null;
  five_scale: number | null;
  score_label: string;
  status_label: string;
  created_by: ProfileOwner | null;
  category: Category | null;
}

export interface AssessmentInput {
  player_profile_id: number;
  coach_profile_id?: number | null;
  assessment_definition_id?: number | null;
  category_id?: number | null;
  custom_category?: string | null;
  training_session_id?: number | null;
  value?: number | null;
  scale?: AssessmentScale;
  status?: AssessmentStatus;
  notes?: string | null;
  assessment_category_scores_attributes?: Array<{
    id?: number;
    assessment_category_id?: number | null;
    value?: number | null;
    scale?: AssessmentScale;
    notes?: string | null;
  }>;
}

export type AssessmentUpdateInput = Partial<Omit<AssessmentInput, "player_profile_id">>;
export interface AssessmentFilters {
  player_id?: number;
  coach_id?: number;
  category_id?: number;
  training_session_id?: number;
  status?: AssessmentStatus;
  mine?: boolean;
  page?: number;
  per_page?: number;
}


export type AssessmentSessionStatus = "draft" | "published" | "withdrawn";
export type AssessmentSessionInclusion = "included" | "excluded";

export interface AssessmentSessionCategory {
  id: number;
  label: string;
  weight: number;
  position: number;
}

export interface AssessmentSessionDefinition {
  id: number;
  name: string;
  status: AssessmentDefinitionStatus;
  assessment_categories: AssessmentSessionCategory[];
}

export interface AssessmentSessionCategoryScore {
  assessment_category_id: number;
  /** The coach's own typed entry, on `scale`. Null when the cell was left blank. */
  reported_value: number | null;
  scale: AssessmentScale;
  /** The canonical 0-100 value after conversion through `scale`. */
  score: number | null;
}

// ---------- Groups (Phase A / D23) ----------

/**
 * A named roster ("U19 squad"). A group is a *selection aid* only: membership
 * carries no authorization and no attendance, so nothing about a group changes
 * what a coach may schedule. The lifecycle is archive-not-delete, and the
 * visibility switch is presentation, never access control.
 */
export type GroupStatus = "active" | "archived";
export type GroupVisibility = "shared" | "private";

export interface Group {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: GroupStatus;
  status_label: string;
  visibility: GroupVisibility;
  /** Roster size, so a picker can label a squad without loading its members. */
  player_count: number;
  /**
   * The organisation this group belongs to — plan §10's "people who share an
   * Organisation". `null` for a group placed before it was recorded, and until an
   * administrator places it.
   */
  organisation: { id: number; name: string } | null;
  /** Who runs it, from the membership rather than from `created_by`. */
  owner: { id: number; name: string | null } | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  /** The GroupMembership id (not the person id). */
  id: number;
  /** Keyed on Person (§2.2), so a member need not have a player profile. */
  person_id: number;
  name: string | null;
  /**
   * Present only when this person has registered as a player. A squad may hold a
   * coach, a parent or a volunteer, and these are legitimately null for them.
   */
  player_profile_id: number | null;
  level: string | null;
  preferred_position: string | null;
  email: string | null;
  role: "owner" | "coach" | "member";
  status: "active" | "ended";
  joined_at: string | null;
  /** Set only when the membership ended (§2.5). */
  left_at: string | null;
}

/** `show` returns the summary plus the roster rows. */
export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface GroupInput {
  name: string;
  description?: string | null;
  visibility?: GroupVisibility;
  status?: GroupStatus;
  /**
   * The organisation the group belongs to. Optional, but the server refuses to
   * create it for an organisation the caller is not an active member of.
   */
  organisation_id?: number | null;
}

export interface AssessmentSessionRankingRow {
  player_profile_id: number;
  player_name: string;
  assessment_id?: number | null;
  overall_score: number | null;
  rank: number | null;
  missing_category_ids: number[];
  /** The per-category entries behind `overall_score`; empty when unscored. */
  category_scores?: AssessmentSessionCategoryScore[];
  status?: string;
  missing_reason?: string | null;
}

export interface AssessmentSessionRankingPayload {
  ranking: AssessmentSessionRankingRow[];
  incomplete: AssessmentSessionRankingRow[];
  excluded: AssessmentSessionRankingRow[];
}

export interface AssessmentSessionParticipant {
  id: number;
  player_profile_id: number;
  player_name: string;
  inclusion: AssessmentSessionInclusion;
  missing_reason?: string | null;
  result?: AssessmentSessionRankingRow;
}

/**
 * A hierarchical organisational context: a federation, a state body, a club.
 * `parent_organisation_id` builds an unbounded tree — nothing assumes a fixed
 * number of tiers — and `organisation_type` is a label only, never something
 * behaviour branches on.
 */
export type OrganisationType =
  | "international_federation"
  | "national_federation"
  | "state_federation"
  | "club"
  | "academy"
  | "school"
  | "association"
  | "other";

/**
 * One person's membership of one organisation.
 *
 * The `status` is a lifecycle, not a mood: `pending` means an invitation nobody has
 * accepted, which is the only state that can be withdrawn outright. Ending a real
 * member's membership is `ended` and the row survives, because a historical
 * assessment has to remain explicable by the membership that existed at the time.
 */
export interface OrganisationMembership {
  id: number;
  organisation_id: number;
  person_id: number;
  person_name: string | null;
  role: OrganisationMembershipRole;
  role_label: string;
  status: "pending" | "active" | "suspended" | "ended";
  status_label: string;
  joined_at: string | null;
  left_at: string | null;
  /** Whether this person may run the organisation's roster. */
  manages: boolean;
  organisation?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export type OrganisationMembershipRole = "owner" | "administrator" | "coach" | "member";

export interface OrganisationMembershipList {
  organisation: { id: number; name: string };
  data: OrganisationMembership[];
}

/** Outcome of leaving or withdrawing: the row survives only for a real departure. */
export interface OrganisationMembershipEnded {
  removed: boolean;
  person_id?: number;
  membership?: OrganisationMembership;
  message?: string;
}

export interface Organisation {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /**
   * Short display form ("FIVB"), or null. Preferred over initials derived from the
   * name: "Fédération Internationale de Volleyball" would otherwise fall back to
   * "FÉ".
   */
  acronym: string | null;
  organisation_type: OrganisationType;
  status: "active" | "archived";
  status_label: string;
  parent_organisation_id: number | null;
  parent_organisation: { id: number; name: string } | null;
  /** Immediate children only; the full subtree is deliberately not inlined. */
  child_count: number;
  /** Tiers above this organisation, 0 for a root. */
  depth: number;
  /** Absolute URL, or null when no logo is attached. */
  logo_url: string | null;
  logo_attached: boolean;
  /**
   * Whether the signed-in user may change this record. Per organisation, not per
   * role: a curator can edit all of them, a club's owner only their own. The server
   * is the authority — this only decides which controls to render, and a stale
   * `true` would simply earn a 403.
   */
  can_edit: boolean;
  /**
   * Whether a hard delete is possible at all: admin-only, and refused for anything
   * with children or members. A real club is archived, never deleted.
   */
  can_delete: boolean;
  /**
   * Whether the caller may run this organisation's roster. Per organisation, not
   * per role, and narrower than `can_edit`: a curator may correct any record but is
   * not an officer of any club.
   */
  can_manage_members: boolean;
  created_by_person: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface OrganisationInput {
  name: string;
  description?: string | null;
  /** Omit to leave unchanged on an edit; null or "" clears it. */
  acronym?: string | null;
  organisation_type?: OrganisationType;
  parent_organisation_id?: number | null;
}

/**
 * A club ranking this session was merged into. `included_in_ranking` is the
 * snapshot's own record of whether this session's scores are in the numbers: a
 * withdrawn source stays attached to its ranking without contributing to it, so
 * the two must never be inferred from one another.
 */
export interface AssessmentSessionConsolidation {
  id: number;
  name: string | null;
  status: RankingConsolidationStatus;
  status_label: string;
  published_at: string | null;
  included_in_ranking: boolean;
}

export interface AssessmentSession {
  id: number;
  name: string;
  status: AssessmentSessionStatus;
  status_label: string;
  scheduled_on: string;
  notes?: string | null;
  published_at?: string | null;
  created_by_id: number;
  coach_profile_id: number;
  coach_profile: {
    id: number;
    full_name: string;
  };
  group_id?: number | null;
  group?: { id: number; name: string } | null;
  assessment_definition: AssessmentSessionDefinition;
  ranking: AssessmentSessionRankingPayload;
  participants: AssessmentSessionParticipant[];
  /** The club rankings this session feeds. Empty when it has not been merged yet. */
  consolidations?: AssessmentSessionConsolidation[];
}

export interface AssessmentSessionInput {
  name: string;
  assessment_definition_id: number;
  coach_profile_id: number;
  group_id?: number | null;
  scheduled_on: string;
  notes?: string | null;
}

export interface AssessmentSessionPlayerInput {
  player_profile_id?: number;
  inclusion?: AssessmentSessionInclusion;
  missing_reason?: string | null;
  person?: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
  };
}

export interface AssessmentSessionCategoryScoreInput {
  assessment_category_id: number;
  scale?: AssessmentScale;
  value?: number | null;
  score?: number | null;
  reported_value?: number | null;
  notes?: string | null;
}

export interface AssessmentSessionScoreInput {
  player_profile_id: number;
  category_scores: AssessmentSessionCategoryScoreInput[];
}


// ---------- Ranking consolidation (Phase 4) ----------
// A consolidation is an immutable snapshot merging several coaches' published
// session results into one club ranking. Nothing here is ever edited: the
// source sessions are snapshotted at creation, so withdrawing a session later
// cannot rewrite the record (D24).
/** One source session's frozen ranking, as captured at creation. */
export interface RankingConsolidationSnapshotEntry {
  player_profile_id: number;
  overall_score: number;
  rank: number;
}

export interface RankingConsolidationSource {
  assessment_session_id: number;
  name: string | null;
  coach_name: string | null;
  /**
   * Whether this source is finished. A draft source holds the whole consolidation
   * back from being published, so the UI badges it rather than hiding it.
   */
  status?: AssessmentSessionStatus | null;
  status_label?: string | null;
  /**
   * How many players this session left incomplete, plus their names (D21). A
   * consolidation never blocks over these, so the session records why it merged
   * anyway and the UI badges it.
   */
  incomplete_count: number;
  incomplete_players: string[];
  /**
   * When this source was retracted. Present only for a withdrawn source, and the
   * basis for telling "already excluded" from "still counted" against the ranking's
   * `computed_at` — live status alone cannot answer that.
   */
  withdrawn_at?: string | null;
  /**
   * Whether this source's scores are in the figures being shown. A published ranking
   * keeps a source that was withdrawn after it was frozen, so this stays `true` until
   * the ranking is recalculated. Inferring it from `status` would make the UI claim a
   * session is excluded while its scores are still on screen.
   */
  included_in_ranking: boolean;
  ranking_snapshot: RankingConsolidationSnapshotEntry[];
}

/**
 * One ranked player. `coach_scores` maps a source session id to the score that
 * coach gave; `coverage` is how many source sessions ranked the player. A player
 * absent from some sessions averages over the covered ones only and is reported
 * through a `coverage` below the session count — never zero-filled (D21).
 */
export interface RankingConsolidationRow {
  player_profile_id: number;
  player_name: string;
  coach_scores: Record<string, number>;
  coverage: number;
  average_score: number;
  rank: number;
}

/**
 * A source session that contributed fewer ranked rows than it had participants,
 * captured at merge time so the consolidation explains itself even after the
 * source session changes (D21).
 */
export interface RankingConsolidationWarning {
  assessment_session_id: number;
  name: string;
  incomplete_count: number;
  incomplete_players: string[];
}

/** A consolidation is assembled as a draft and frozen when published. */
export type RankingConsolidationStatus = "draft" | "published" | "withdrawn";

export interface RankingConsolidation {
  id: number;
  name: string;
  notes?: string | null;
  status: RankingConsolidationStatus;
  status_label: string;
  published_at: string | null;
  created_by_id?: number | null;
  assessment_definition: { id: number; name: string };
  session_count: number;
  player_count: number;
  /**
   * How many source sessions are still drafts. This is the publish gate: a
   * consolidation stays a draft until every source is finished. Withdrawn sessions
   * are NOT counted here — they are excluded from the ranking rather than blocking
   * it, and are reported by `withdrawn_session_count`.
   */
  unpublished_session_count: number;
  /**
   * How many source sessions were withdrawn. They stay in the consolidation but
   * contribute no scores, so the coach is told which sessions are being left out of
   * the ranking.
   */
  withdrawn_session_count: number;
  /**
   * Withdrawn sources whose scores are *still in* the figures on screen, because they
   * were retracted after this ranking was computed. A withdrawal does not cascade, so
   * these keep counting until someone recalculates — which is why they must not be
   * reported as excluded.
   */
  stale_withdrawn_session_count: number;
  /**
   * Withdrawn sources already absent from the figures, because they were retracted
   * before the ranking was computed and the merge skipped them.
   */
  excluded_withdrawn_session_count: number;
  /**
   * Sources the merge skipped that have since been restored to published. They are
   * scoring again, but the frozen ranking is not using them, so it under-reports
   * until it is recalculated. The mirror of `stale_withdrawn_session_count`.
   */
  restored_session_count: number;
  /**
   * When these figures were computed: the original publication, or a later
   * recalculation. Compare against a source's `withdrawn_at` to tell a retracted
   * session that is out of the numbers from one that is still counted in them.
   */
  computed_at: string | null;
  /** Set only when a curator/admin has corrected the ranking after publication. */
  recalculated_at: string | null;
  recalculated_by_id?: number | null;
  /**
   * Whether there is anything to correct: a published ranking with a source retracted
   * after it was frozen.
   */
  recalculable: boolean;
  /**
   * Whether the signed-in user may do it. `recalculable` describes the ranking, this
   * describes the viewer — recalculating is curator/admin work, so a coach is not
   * shown a button that would be refused.
   */
  can_recalculate: boolean;
  source_warnings: RankingConsolidationWarning[];
  assessment_sessions: RankingConsolidationSource[];
  rows: RankingConsolidationRow[];
}

export interface RankingConsolidationInput {
  name: string;
  assessment_definition_id: number;
  assessment_session_ids: number[];
  notes?: string | null;
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
 * Who may see a player/coach in the catalogues. `shared` is the normal case:
 * every training manager sees the profile. `private` hides it from other
 * coaches' lists and detail — the coach who recorded it keeps it to
 * themselves. Curators and admins always see everything, and the flag never
 * blocks scheduling: any coach can still add any player to any session. Soft
 * means *presentation*, not authorization — the only hard rule is that the
 * switch itself may be flipped only by the owner or an admin.
 */
export type ProfileVisibility = "shared" | "private";

/** Who recorded the profile (nil for rows created before Phase C). */
export interface ProfileOwner {
  id: number;
  name: string;
}

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
  /** Complete profile lists; singular keys remain during client migration. */
  player_profile_ids?: number[];
  coach_profile_ids?: number[];
  /**
   * Alternate names (nicknames, previous names after a rename). Not identity
   * evidence, but how a coach usually recognises someone.
   */
  aliases?: string[];
  organisation_memberships?: OrganisationMembership[];
}

/** Nested attributes for organisation memberships (mirrors Rails convention). */
export interface OrganisationMembershipInput {
  id?: number;
  organisation_id: number;
  role: OrganisationMembershipRole;
  status: "pending" | "active" | "suspended" | "ended";
  _destroy?: boolean;
}

export interface UserGroupMembership {
  id: number;
  group_id: number;
  role: "owner" | "coach" | "member";
  status: "active" | "ended";
  joined_at: string | null;
  left_at: string | null;
  group: {
    id: number;
    name: string;
    status: GroupStatus;
    organisation: { id: number; name: string } | null;
  };
}

/**
 * One period of coaching: a coach coaching a player (plan Phase 5).
 *
 * The period *is* the lifecycle — `end_date` null means "still coaching" and a
 * non-null value is a historical period that is kept forever (an ended
 * relationship explains a past assessment, so it is never deleted). `current` is
 * derived from `end_date` by the server rather than stored, so a client can
 * never be told a relationship is running when its dates say otherwise.
 */
export interface PlayerCoach {
  id: number;
  player_profile_id: number;
  coach_profile_id: number;
  player_name: string | null;
  coach_name: string | null;
  /** `YYYY-MM-DD` (a Rails `date`, not a timestamp). */
  start_date: string;
  end_date: string | null;
  current: boolean;
  /** Length of an ended period, in days. Nil while the relationship is open. */
  duration_in_days: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create payload. Only one side is sent: the page names its own profile and the
 * picker supplies the other. `start_date` defaults to today server-side.
 */
export interface PlayerCoachInput {
  player_profile_id?: number;
  coach_profile_id?: number;
  start_date?: string;
}

export interface ProfilePerson {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  creation_source: CreationSource | string;
  organisation_memberships?: OrganisationMembership[];
}

export interface Player {
  id: number;
  person_id: number | null;
  display_name?: string | null;
  preferred_position: string | null;
  level: string | null;
  status: ProfileStatus;
  /** Soft visibility: `shared` for everyone, `private` for the owner only. */
  visibility: ProfileVisibility;
  /** Who recorded the player (null for rows created before Phase C). */
  created_by: ProfileOwner | null;
  created_at: string;
  updated_at: string;
  full_name?: string;
  account_status?: AccountStatus;
  player_profile_id?: number;
  training_session_count?: number;
  assessment_count?: number;
  assessments?: Assessment[];
  person: ProfilePerson | null;
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

export interface ProfileMergeResult {
  id: number;
  source_profile_id: number;
  canonical_profile_id: number;
  reference_counts: Record<string, number>;
  merged_at: string;
}

/**
 * Create payload. Name the human either way:
 *   * `person_id` — link a profile to a person that already exists (the result
 *     of a people search);
 *   * `person`    — record a new person, with no Account (coach_created).
 *
 * Omit `person` and `person_id` entirely to record a profile with no Person
 * (`display_name` only). That is the state a claim invitation can later be
 * issued against; a profile linked to a Person never needs one.
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
    /** Required when recording a player before their Person is known. */
    display_name?: string;
    preferred_position?: string | null;
    level?: string | null;
    status?: ProfileStatus;
    visibility?: ProfileVisibility;
  };
}

export interface PlayerClaim {
  id: number;
  player_profile_id: number | null;
  claimable_type?: string | null;
  claimable_id?: number | null;
  claimant_account_id?: number | null;
  person_id: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  reviewed_at: string | null;
  verification_method?: "staff_confirmed" | "government_id" | "in_person" | "other" | null;
  reviewed_by_account_id?: number | null;
  rejection_reason?: string | null;
  player_name?: string;
}

/** Safe, unconfirmed suggestion returned by player profile candidate search. */
export interface PlayerProfileCandidate {
  id: number;
  player_profile_id?: number;
  coach_profile_id?: number;
  claimable_type?: "PlayerProfile" | "CoachProfile";
  claimable_id?: number;
  display_name: string;
  match_type: "exact_name" | "partial_name" | "name_search";
  result_type: "candidate";
}

export interface ClaimInvitation {
  id: number;
  /** Which kind of record this invitation is about. */
  claimable_type: "PlayerProfile" | "CoachProfile" | "Person";
  claimable_id: number;
  /** Retained so an existing client reading the player key keeps working. */
  player_profile_id: number | null;
  /** Set when the subject is a Person with no account. */
  person_id: number | null;
  invitee_email: string | null;
  /** Delivery telemetry; linking is authorized by a verified exact email match. */
  emailed_at: string | null;
  /** Whether an exact verified email match may link without staff review. */
  auto_approvable: boolean;
  status: "active" | "used" | "revoked" | "expired" | "declined";
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  declined_at?: string | null;
  created_at: string;
  claimable_name?: string | null;
}

export interface ManagementClaim extends PlayerClaim {
  can_review: boolean;
}

export interface ManagementClaimableProfile {
  claimable_type: "PlayerProfile" | "CoachProfile";
  claimable_id: number;
  display_name: string;
  status: ProfileStatus;
  linked_to_account: boolean;
  can_invite: boolean;
}

/** What redeeming an invitation actually did. */
export type ClaimRedemptionOutcome =
  | {
      outcome: "linked";
      invitation: ClaimInvitation;
      person: PersonIdentity;
    }
  | {
      outcome: "pending_review";
      invitation: ClaimInvitation;
      claim: PlayerClaim;
      message: string;
    };

/** One-time invitation for an Account to claim a PlayerProfile or CoachProfile. */
export interface CreatedPlayerClaimInvitation {
  invitation: ClaimInvitation;
  /** Returned only when the invitation is created. Keep it out of persistent client storage. */
  token: string;
}

export interface Coach {
  id: number;
  /** Null for a coach profile recorded without a Person (Phase 18). */
  person_id: number | null;
  /** Only set on a profile recorded without a Person. */
  display_name?: string | null;
  coaching_level: string | null;
  qualifications: string | null;
  status: ProfileStatus;
  /** Soft visibility: `shared` for everyone, `private` for the owner only. */
  visibility: ProfileVisibility;
  /** Who recorded the coach (null for rows created before Phase C). */
  created_by: ProfileOwner | null;
  created_at: string;
  updated_at: string;
  full_name?: string;
  account_status?: AccountStatus;
  coach_profile_id?: number;
  assessments_recorded_count?: number;
  recent_assessments?: Assessment[];
  person: ProfilePerson | null;
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
    display_name?: string;
    coaching_level?: string | null;
    qualifications?: string | null;
    status?: ProfileStatus;
    visibility?: ProfileVisibility;
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
  /** Present for the signed-in user; used to default assessment attribution. */
  person_id?: number | null;
  coach_profile_id?: number | null;
  /** All coaching records for the authenticated Person; the singular ID is a legacy default. */
  coach_profile_ids?: number[];
  coach_profiles?: CoachContext[];
  player_profile_id?: number | null;
  /** Complete caller-owned profile and membership context from GET /me. */
  account_id?: number | null;
  player_profile_ids?: number[];
  player_profiles?: PlayerContext[];
  organisation_memberships?: OrganisationMembership[];
  group_memberships?: UserGroupMembership[];
}

export interface CoachContext {
  id: number;
  coaching_level: string | null;
  qualifications: string | null;
  status: "active" | "archived";
}

export interface PlayerContext {
  id: number;
  display_name: string | null;
  preferred_position: string | null;
  level: string | null;
  status: ProfileStatus;
  visibility: ProfileVisibility;
}

export interface UserWithToken extends User {
  token?: string;
  /** Present when the account still needs email verification (no session). */
  status?: "pending_verification";
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
  email: string | null;
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

/**
 * Posts multipart form data, for the one endpoint that accepts a file.
 *
 * Deliberately does not set `Content-Type`: the browser must add it *with* the
 * multipart boundary, and setting it by hand produces a body the server cannot
 * parse. Error handling mirrors `postJSON` so a rejected upload surfaces the same
 * way as any other API failure.
 */
async function postFormData<T>(endpoint: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: form,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
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

  // ---------- Legacy identity search (staff only) ----------
  /**
   * The identity typeahead: a bare array, hard-capped server-side at 25. It is a
   * shape stays stable for profile creation and organisation roster workflows.
   */
  people: (params?: { q?: string; email?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    const query = qs.toString();
    return fetchAPI<PersonIdentity[]>(`/people/search${query ? `?${query}` : ""}`);
  },

  // ---------- Players (read: training managers; create: coach/admin) ----------
  /**
   * Paginated catalogue (`{ data, meta }`, 20 per page by default).
   * The training form's player picker asks for `include_private` (plus a
   * `per_page` big enough to hold the roster), so it can filter locally while
   * a coach types — visibility never blocks scheduling.
   */
  players: async (params?: {
    q?: string;
    email?: string;
    status?: ProfileStatus;
    include_private?: boolean;
    mine?: boolean;
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    if (params?.status) qs.set("status", params.status);
    if (params?.include_private) qs.set("include_private", "1");
    if (params?.mine) qs.set("mine", "1");
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
  deletePlayer: (id: number) => postJSON<void>(`/players/${id}`, {}, "DELETE"),
  mergePlayerProfile: (id: number, canonicalProfileId: number, reason: string) =>
    postJSON<ProfileMergeResult>(`/players/${id}/merge`, {
      canonical_profile_id: canonicalProfileId,
      reason,
    }),

  // ---------- Player claims (self-service request; coach/admin review) ----------
  playerProfileCandidates: () =>
    fetchAPI<PlayerProfileCandidate[] | PaginatedResponse<PlayerProfileCandidate>>(
      "/player_claims/candidates?per_page=100",
    ).then((response) => normalizePaginatedResponse(response).data),
  profileCandidates: (type: "PlayerProfile" | "CoachProfile") =>
    fetchAPI<PlayerProfileCandidate[] | PaginatedResponse<PlayerProfileCandidate>>(
      `/player_claims/candidates?claimable_type=${type}&per_page=100`,
    ).then((response) => normalizePaginatedResponse(response).data),
  searchProfileCandidates: async (params: { type: "PlayerProfile" | "CoachProfile"; q?: string; organisationId?: number; page?: number; perPage?: number }) => {
    const query = new URLSearchParams({ claimable_type: params.type, page: String(params.page ?? 1), per_page: String(params.perPage ?? 20) });
    if (params.q?.trim()) query.set("q", params.q.trim());
    if (params.organisationId) query.set("organisation_id", String(params.organisationId));
    const response = await fetchAPI<PaginatedResponse<PlayerProfileCandidate>>(`/player_claims/candidates?${query}`);
    return normalizePaginatedResponse(response);
  },
  playerClaims: () =>
    fetchAPI<PlayerClaim[] | PaginatedResponse<PlayerClaim>>(
      "/player_claims?per_page=100",
    ).then((response) => normalizePaginatedResponse(response).data),
  managementPlayerClaims: (params: { status?: string; claimableType?: string; page?: number; perPage?: number } = {}) => {
    const query = new URLSearchParams({ management: "1", page: String(params.page ?? 1), per_page: String(params.perPage ?? 20) });
    if (params.status) query.set("status", params.status);
    if (params.claimableType) query.set("claimable_type", params.claimableType);
    return fetchAPI<PaginatedResponse<ManagementClaim>>(`/player_claims?${query}`);
  },
  requestPlayerClaim: (playerProfileId: number) =>
    postJSON<PlayerClaim>("/player_claims", { player_profile_id: playerProfileId }),
  requestProfileClaim: (type: "PlayerProfile" | "CoachProfile", profileId: number) =>
    postJSON<PlayerClaim>("/player_claims", { claimable_type: type, claimable_id: profileId }),
  approvePlayerClaim: (
    id: number,
    verificationMethod: NonNullable<PlayerClaim["verification_method"]>,
  ) =>
    postJSON<PlayerClaim>(`/player_claims/${id}/approve`, {
      verification_method: verificationMethod,
    }),
  rejectPlayerClaim: (id: number, rejectionReason: string) =>
    postJSON<PlayerClaim>(`/player_claims/${id}/reject`, { rejection_reason: rejectionReason }),
  cancelPlayerClaim: (id: number) =>
    postJSON<PlayerClaim>(`/player_claims/${id}/cancel`, {}),

  // ---------- Claim invitations (unified: player profile, coach profile, person) ----------

  /**
   * Invitations for any claimable subject. A matching verified email links
   * immediately even when the link is shared manually; an open invitation
   * without a recipient email files a request for review.
   */
  claimInvitations: (
    claimableType?: ClaimInvitation["claimable_type"],
    claimableId?: number,
  ) =>
    fetchAPI<ClaimInvitation[]>(
      claimableType && claimableId
        ? `/claim_invitations?claimable_type=${claimableType}&claimable_id=${claimableId}`
        : "/claim_invitations",
    ),
  managementClaimInvitations: (params: { status?: string; claimableType?: string; page?: number; perPage?: number } = {}) => {
    const query = new URLSearchParams({ management: "1", page: String(params.page ?? 1), per_page: String(params.perPage ?? 20) });
    if (params.status) query.set("status", params.status);
    if (params.claimableType) query.set("claimable_type", params.claimableType);
    return fetchAPI<PaginatedResponse<ClaimInvitation>>(`/claim_invitations?${query}`);
  },
  managementClaimables: (params: { claimableType?: string; status?: string; linkState?: string; q?: string; page?: number; perPage?: number } = {}) => {
    const query = new URLSearchParams({ page: String(params.page ?? 1), per_page: String(params.perPage ?? 20) });
    if (params.claimableType) query.set("claimable_type", params.claimableType);
    if (params.status) query.set("status", params.status);
    if (params.linkState) query.set("link_state", params.linkState);
    if (params.q?.trim()) query.set("q", params.q.trim());
    return fetchAPI<PaginatedResponse<ManagementClaimableProfile>>(`/claim_invitations/claimables?${query}`);
  },
  receivedClaimInvitations: () => fetchAPI<ClaimInvitation[]>("/claim_invitations/received"),
  acceptReceivedClaimInvitation: (id: number) => postJSON<ClaimRedemptionOutcome>(`/claim_invitations/${id}/accept`, {}),
  declineReceivedClaimInvitation: (id: number) => postJSON<ClaimInvitation>(`/claim_invitations/${id}/decline`, {}),
  createClaimInvitation: (
    claimableType: ClaimInvitation["claimable_type"],
    claimableId: number,
    inviteeEmail?: string,
  ) =>
    postJSON<{
      invitation: ClaimInvitation;
      token: string;
      email_delivered: boolean;
    }>("/claim_invitations", {
      claimable_type: claimableType,
      claimable_id: claimableId,
      invitee_email: inviteeEmail,
    }),
  redeemClaimInvitation: (token: string) =>
    postJSON<ClaimRedemptionOutcome>("/claim_invitations/redeem", { token }),
  revokeClaimInvitation: (id: number) =>
    postJSON<ClaimInvitation>(`/claim_invitations/${id}/revoke`, {}),

  /** @deprecated Use the unified `claimInvitations` family above. */
  playerClaimInvitations: (playerProfileId: number) =>
    fetchAPI<ClaimInvitation[]>(`/player_claim_invitations?player_profile_id=${playerProfileId}`),
  playerClaimInvitation: (id: number) =>
    fetchAPI<ClaimInvitation>(`/player_claim_invitations/${id}`),
  /**
   * Restrict the invitation to one address: only a signed-in Person whose
   * email matches may redeem it. Omit for an open bearer link (today's
   * behaviour). The server lowercases and trims before comparing.
   */
  createPlayerClaimInvitation: (playerProfileId: number, inviteeEmail?: string) =>
    postJSON<CreatedPlayerClaimInvitation>("/player_claim_invitations", {
      player_profile_id: playerProfileId,
      invitee_email: inviteeEmail,
    }),
  redeemPlayerClaimInvitation: (token: string) =>
    postJSON<ClaimRedemptionOutcome>("/player_claim_invitations/redeem", { token }),
  revokePlayerClaimInvitation: (id: number) =>
    postJSON<ClaimInvitation>(`/player_claim_invitations/${id}/revoke`, {}),

  // ---------- Coaches (read: training managers; create: coach/admin) ----------
  /** Paginated catalogue — see `players`. */
  coaches: async (params?: {
    q?: string;
    email?: string;
    status?: ProfileStatus;
    include_private?: boolean;
    mine?: boolean;
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.email) qs.set("email", params.email);
    if (params?.status) qs.set("status", params.status);
    if (params?.include_private) qs.set("include_private", "1");
    if (params?.mine) qs.set("mine", "1");
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
  deleteCoach: (id: number) => postJSON<void>(`/coaches/${id}`, {}, "DELETE"),
  mergeCoachProfile: (id: number, canonicalProfileId: number, reason: string) =>
    postJSON<ProfileMergeResult>(`/coaches/${id}/merge`, {
      canonical_profile_id: canonicalProfileId,
      reason,
    }),

  // ---------- Assessments (canonical score is derived by the server) ----------
  assessments: (filters: AssessmentFilters = {}) => {
    const qs = new URLSearchParams();
    if (filters.player_id != null) qs.set("player_id", String(filters.player_id));
    if (filters.coach_id != null) qs.set("coach_id", String(filters.coach_id));
    if (filters.category_id != null) qs.set("category_id", String(filters.category_id));
    if (filters.training_session_id != null) qs.set("training_session_id", String(filters.training_session_id));
    if (filters.status) qs.set("status", filters.status);
    if (filters.mine) qs.set("mine", "1");
    if (filters.page != null) qs.set("page", String(filters.page));
    if (filters.per_page != null) qs.set("per_page", String(filters.per_page));
    const query = qs.toString();
    return fetchAPI<PaginatedResponse<Assessment>>(`/assessments${query ? `?${query}` : ""}`);
  },
  assessment: (id: number) => fetchAPI<Assessment>(`/assessments/${id}`),
  createAssessment: (data: AssessmentInput) =>
    postJSON<Assessment>("/assessments", { assessment: data }),
  updateAssessment: (id: number, data: AssessmentUpdateInput) =>
    postJSON<Assessment>(`/assessments/${id}`, { assessment: data }, "PATCH"),
  assessmentDefinitions: (status?: AssessmentDefinitionStatus) =>
    fetchAPI<PaginatedResponse<AssessmentDefinition>>(
      `/assessment_definitions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  assessmentDefinition: (id: number) =>
    fetchAPI<AssessmentDefinition>(`/assessment_definitions/${id}`),
  createAssessmentDefinition: (data: AssessmentDefinitionInput) =>
    postJSON<AssessmentDefinition>("/assessment_definitions", { assessment_definition: data }),
  updateAssessmentDefinition: (id: number, data: Partial<AssessmentDefinitionInput>) =>
    postJSON<AssessmentDefinition>(
      `/assessment_definitions/${id}`,
      { assessment_definition: data },
      "PATCH",
    ),
  reorderAssessmentDefinition: (id: number, ids: number[]) =>
    postJSON<AssessmentDefinition>(
      `/assessment_definitions/${id}/reorder`,
      { ids },
      "PATCH",
    ),
  /**
   * Soft delete: archives a definition so it drops out of circulation but is kept,
   * and can be brought back. Never blocked by usage — hiding a configuration people
   * are still scoring against loses nothing. Admin only.
   */
  archiveAssessmentDefinition: (id: number) =>
    postJSON<AssessmentDefinition>(`/assessment_definitions/${id}/archive`, {}, "POST"),
  /** Undo an archive, returning the definition to draft. Admin only. */
  restoreAssessmentDefinition: (id: number) =>
    postJSON<AssessmentDefinition>(`/assessment_definitions/${id}/restore`, {}, "POST"),
  /**
   * Hard delete, admin only, and only for a definition nothing references. The
   * server refuses when it is in use, so `deletable` is the gate to check first:
   * it is what the UI uses to explain the refusal instead of offering a dead button.
   */
  deleteAssessmentDefinition: (id: number) =>
    postJSON<{ message: string; id: number }>(
      `/assessment_definitions/${id}`,
      {},
      "DELETE",
    ),
  // ---- Coaching relationships (PlayerCoach, plan Phase 5) ------------------
  /**
   * The periods of coaching for one side of the relationship. `status` narrows
   * to `current` (end_date NULL) or `historical`; the default returns both, so a
   * detail page can render the running relationship above its own history in one
   * request. Not paginated: a person has a handful of coaches or players.
   */
  playerCoaches: async (params: {
    player_profile_id?: number;
    coach_profile_id?: number;
    status?: "current" | "historical" | "all";
  }) => {
    const qs = new URLSearchParams();
    if (params.player_profile_id) qs.set("player_profile_id", String(params.player_profile_id));
    if (params.coach_profile_id) qs.set("coach_profile_id", String(params.coach_profile_id));
    if (params.status) qs.set("status", params.status);
    const query = qs.toString();
    const response = await fetchAPI<{ data: PlayerCoach[] }>(
      `/player_coaches${query ? `?${query}` : ""}`,
    );
    return response.data ?? [];
  },
  /**
   * Open a new period. The server refuses a second open period for the same
   * pair with 409 and a coach may only record their own coaching (admin may
   * record any) — those come back as an error, never as a silent second row.
   */
  createPlayerCoach: (data: PlayerCoachInput) =>
    postJSON<PlayerCoach>("/player_coaches", { player_coach: data }),
  /** Correct the dates of a period. Re-pointing it is a new relationship. */
  updatePlayerCoach: (id: number, data: Partial<PlayerCoachInput>) =>
    postJSON<PlayerCoach>(`/player_coaches/${id}`, { player_coach: data }, "PATCH"),
  /**
   * End the period. Deliberately `POST /end_relationship`, not DELETE: an ended
   * relationship is the context that makes a past assessment explicable, so the
   * row survives with an end date. Resuming later is a *new* period.
   */
  endPlayerCoach: (id: number, endDate?: string) =>
    postJSON<PlayerCoach>(
      `/player_coaches/${id}/end_relationship`,
      { player_coach: endDate ? { end_date: endDate } : {} },
      "POST",
    ),

  // ---- Organisations -------------------------------------------------------
  /**
   * `tree` asks for the whole hierarchy unpaginated, for the tree view. A page
   * boundary is meaningless there: a child whose parent is on another page has
   * nothing to be drawn under, and a client walking from the roots loses it.
   *
   * `mine` narrows to the organisations the caller actively belongs to — the
   * choices worth offering somebody creating a group.
   */
  organisations: (
    status?: string,
    type?: string,
    tree = false,
    mine = false,
  ) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("organisation_type", type);
    if (tree) params.set("tree", "1");
    if (mine) params.set("mine", "1");
    const query = params.toString();
    return fetchAPI<PaginatedResponse<Organisation>>(
      `/organisations${query ? `?${query}` : ""}`,
    );
  },
  organisation: (id: number) => fetchAPI<Organisation>(`/organisations/${id}`),
  createOrganisation: (data: OrganisationInput) =>
    postJSON<Organisation>("/organisations", { organisation: data }),
  updateOrganisation: (id: number, data: Partial<OrganisationInput>) =>
    postJSON<Organisation>(
      `/organisations/${id}`,
      { organisation: data },
      "PATCH",
    ),
  archiveOrganisation: (id: number) =>
    postJSON<Organisation>(`/organisations/${id}/archive`, {}),
  restoreOrganisation: (id: number) =>
    postJSON<Organisation>(`/organisations/${id}/restore`, {}),
  /**
   * Hard delete, and unlike every archival action above it is not reversible.
   *
   * The server refuses it for an organisation with children or members, so a
   * 409 here is a normal answer rather than an error: a real club is archived,
   * and only a mistake is deleted.
   */
  deleteOrganisation: (id: number) =>
    postJSON<{ message: string; id: number }>(`/organisations/${id}`, {}, "DELETE"),

  // ---------- Organisation membership -----------------------------------------
  // Delegated to the organisation's own officers, not the site admin, so these
  // read a roster that may be far narrower than the full list.

  /** The roster. Managers see everyone; others see only their own row and history. */
  organisationMembers: (id: number) =>
    fetchAPI<OrganisationMembershipList>(`/organisations/${id}/members`),
  /**
   * Invite someone. Defaults to a `pending` invitation server-side — adding
   * somebody to a roster is an invitation, not a grant.
   */
  addOrganisationMember: (
    id: number,
    personId: number,
    data: { role?: OrganisationMembershipRole; status?: string } = {},
  ) =>
    postJSON<OrganisationMembership>(`/organisations/${id}/members`, {
      membership: { person_id: personId, ...data },
    }),
  updateOrganisationMember: (
    id: number,
    personId: number,
    data: { role?: OrganisationMembershipRole; status?: string },
  ) =>
    postJSON<OrganisationMembership>(`/organisations/${id}/members/${personId}`, {
      membership: data,
    },
    "PATCH"),
  /**
   * Leave or withdraw. A real member's membership ends and the row survives; an
   * unaccepted invitation is withdrawn and removed. `removed` says which happened.
   */
  endOrganisationMember: (id: number, personId: number) =>
    postJSON<OrganisationMembershipEnded>(
      `/organisations/${id}/members/${personId}`,
      {},
      "DELETE",
    ),
  /**
   * Uploads or replaces a logo. Multipart, and on its own route so the JSON
   * `update` above keeps a single content-type contract. The server validates
   * content type, size and pixel dimensions.
   */
  uploadOrganisationLogo: (id: number, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return postFormData<Organisation>(`/organisations/${id}/logo`, form);
  },

  assessmentSessions: () =>
    fetchAPI<{ assessment_sessions: AssessmentSession[] }>("/assessment_sessions"),
  assessmentSession: (id: number) =>
    fetchAPI<{ assessment_session: AssessmentSession }>(`/assessment_sessions/${id}`),
  createAssessmentSession: (data: AssessmentSessionInput) =>
    postJSON<{ assessment_session: AssessmentSession }>("/assessment_sessions", {
      assessment_session: data,
    }),
  updateAssessmentSession: (id: number, data: Partial<AssessmentSessionInput>) =>
    postJSON<{ assessment_session: AssessmentSession }>(
      `/assessment_sessions/${id}`,
      { assessment_session: data },
      "PATCH",
    ),
  addAssessmentSessionPlayers: (id: number, players: AssessmentSessionPlayerInput[]) =>
    postJSON<{ assessment_session: AssessmentSession; added: number }>(
      `/assessment_sessions/${id}/add_players`,
      { players },
    ),
  removeAssessmentSessionPlayers: (id: number, playerProfileIds: number[]) =>
    postJSON<{ assessment_session: AssessmentSession; removed: number }>(
      `/assessment_sessions/${id}/remove_players`,
      { player_profile_ids: playerProfileIds },
      "PATCH",
    ),
  saveAssessmentSessionScores: (id: number, scores: AssessmentSessionScoreInput[]) =>
    postJSON<{ assessment_session: AssessmentSession }>(
      `/assessment_sessions/${id}/scores`,
      { scores },
      "PUT",
    ),
  publishAssessmentSession: (id: number) =>
    postJSON<{ assessment_session: AssessmentSession }>(
      `/assessment_sessions/${id}/publish`,
      {},
      "POST",
    ),
  /**
   * Retract a published session. Reversible by an admin via `restore`; deleting
   * is a separate, admin-only, irreversible route.
   */
  withdrawAssessmentSession: (id: number) =>
    postJSON<{ assessment_session: AssessmentSession }>(
      `/assessment_sessions/${id}/withdraw`,
      {},
      "POST",
    ),
  /** Admin only. `to` is "draft" or "published". */
  restoreAssessmentSession: (id: number, to: "draft" | "published") =>
    postJSON<{ assessment_session: AssessmentSession }>(
      `/assessment_sessions/${id}/restore`,
      { to_status: to },
      "POST",
    ),
  /**
   * Discard a draft session. A published or withdrawn one may be deleted by an
   * admin only, as the escape hatch for a publication that should not have
   * happened.
   */
  deleteAssessmentSession: (id: number) =>
    postJSON<{ message: string; id: number }>(
      `/assessment_sessions/${id}`,
      {},
      "DELETE",
    ),
  assessmentSessionRanking: (id: number) =>
    fetchAPI<{
      assessment_session: {
        id: number;
        name: string;
        status: AssessmentSessionStatus;
        scheduled_on: string;
        assessment_definition: AssessmentSessionDefinition;
      };
      ranking: AssessmentSessionRankingRow[];
      incomplete: AssessmentSessionRankingRow[];
      excluded: AssessmentSessionRankingRow[];
    }>(`/assessment_sessions/${id}/ranking`),

  // ---------- Groups (Phase A / D23) ----------
  // Read is open to training managers; create/update/delete need coach or admin.
  // The picker asks for `include_private` because visibility is presentation
  // only — a coach may schedule any group they can see the name of.
  groups: async (params?: {
    q?: string;
    status?: GroupStatus | "all";
    include_private?: boolean;
    mine?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    if (params?.include_private) qs.set("include_private", "1");
    if (params?.mine) qs.set("mine", "1");
    const query = qs.toString();
    const response = await fetchAPI<Group[] | PaginatedResponse<Group>>(
      `/groups${query ? `?${query}` : ""}`,
    );
    return normalizePaginatedResponse(response);
  },
  /** Accepts an id or a slug; the API resolves both. */
  group: (id: number | string) =>
    fetchAPI<{ group: GroupDetail }>(`/groups/${id}`),
  createGroup: (data: GroupInput, personIds: number[] = []) =>
    postJSON<{ group: GroupDetail }>("/groups", {
      group: data,
      person_ids: personIds,
    }),
  /** Omit `personIds` to leave the roster untouched; pass `[]` to clear it. */
  updateGroup: (id: number, data: GroupInput, personIds?: number[]) =>
    postJSON<{ group: GroupDetail }>(
      `/groups/${id}`,
      {
        group: data,
        ...(personIds ? { person_ids: personIds } : {}),
      },
      "PATCH",
    ),
  /** Refused with 422 when the group has already run sessions — archive instead. */
  deleteGroup: (id: number) =>
    postJSON<{ message: string; id: number }>(`/groups/${id}`, {}, "DELETE"),
  /**
   * Adds people to the roster by **person**, not by player profile: a squad can
   * hold somebody who has never registered as one (§2.2). The server refuses
   * anybody who is not an active member of the group's organisation.
   */
  addGroupMembers: (id: number, personIds: number[]) =>
    postJSON<{ group: GroupDetail; added: number }>(`/groups/${id}/members`, {
      person_ids: personIds,
    }),
  /**
   * Ends the membership rather than deleting the row (§2.5). Refused with 422 for
   * the group's owner, who cannot be walked away from.
   */
  removeGroupMember: (id: number, personId: number) =>
    postJSON<{ group: GroupDetail; removed: number }>(
      `/groups/${id}/members/${personId}`,
      {},
      "DELETE",
    ),

  /**
   * Join an organisation yourself. Separate from `addOrganisationMember`, which an
   * officer uses on somebody else: this writes your own row, so it cannot grant a
   * role — you become a `member` whatever you send. 409 if you already belong.
   */
  joinOrganisation: (id: number) =>
    postJSON<{ membership: OrganisationMembership }>(`/organisations/${id}/join`, {}),

  // ---------- Ranking consolidations (Phase 4) ----------
  // Archival records: there is no update or delete. A correction is a new
  // consolidation, so a published club ranking can never be quietly rewritten.
  rankingConsolidations: () =>
    fetchAPI<{ ranking_consolidations: RankingConsolidation[] }>("/ranking_consolidations"),
  rankingConsolidation: (id: number) =>
    fetchAPI<{ ranking_consolidation: RankingConsolidation }>(`/ranking_consolidations/${id}`),
  createRankingConsolidation: (data: RankingConsolidationInput) =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>("/ranking_consolidations", {
      ranking_consolidation: data,
    }),
  /**
   * Freeze a draft as the club's official ranking. Refused with 422 while any
   * source session is still unpublished; the server re-derives the ranking from
   * the sessions' current scores before freezing it, so a published ranking can
   * never disagree with the sessions behind it.
   */
  publishRankingConsolidation: (id: number) =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>(
      `/ranking_consolidations/${id}/publish`,
      {},
      "POST",
    ),
  /**
   * Retract a published ranking. Reversible: an admin can restore it to draft or
   * published. Deleting is a separate, admin-only, irreversible route.
   */
  withdrawRankingConsolidation: (id: number) =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>(
      `/ranking_consolidations/${id}/withdraw`,
      {},
      "POST",
    ),
  /** Admin only. `to` is "draft" or "published"; published re-derives the ranking. */
  restoreRankingConsolidation: (id: number, to: "draft" | "published") =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>(
      `/ranking_consolidations/${id}/restore`,
      { to_status: to },
      "POST",
    ),
  /**
   * Rebuild a published ranking so a source withdrawn *after* publication stops
   * contributing. Curator/admin only, and only offered when `can_recalculate` — a
   * withdrawal never cascades on its own, so this is the deliberate, recorded
   * correction. `published_at` is preserved; `recalculated_at` records the change.
   */
  recalculateRankingConsolidation: (id: number) =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>(
      `/ranking_consolidations/${id}/recalculate`,
      {},
      "POST",
    ),
  updateRankingConsolidation: (
    id: number,
    data: Pick<RankingConsolidationInput, "name" | "notes">,
  ) =>
    postJSON<{ ranking_consolidation: RankingConsolidation }>(
      `/ranking_consolidations/${id}`,
      { ranking_consolidation: data },
      "PATCH",
    ),
  deleteRankingConsolidation: (id: number) =>
    postJSON<{ message: string; id: number }>(
      `/ranking_consolidations/${id}`,
      {},
      "DELETE",
    ),

  categoryCustoms: () => fetchAPI<CategoryCustom[]>("/category_customs"),
  createCategoryCustom: (data: { name: string; visibility?: "shared" | "private" }) =>
    postJSON<CategoryCustom>("/category_customs", { category_custom: data }),

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
        // Pending verification never carries an email token or session token.
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
      // Same guard as login: no session is created until email verification.
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
    email: string | null;
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
