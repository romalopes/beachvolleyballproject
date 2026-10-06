import type { ProfileStatus, User } from "../api";
import { api } from "../api";

/**
 * Recording and editing player/coach profiles is what coaches and admins do —
 * a curator manages the shared schedule but not the club's roster. Mirrors the
 * backend's `require_content_creator!`, so the UI never offers a button that
 * would come back 403.
 */
export function canManageProfiles(user: User | null | undefined): boolean {
  return Boolean(
    user?.roles?.some((role) => role === "coach" || role === "admin"),
  );
}

/**
 * Archiving is the normal history-preserving removal path. A separate guarded
 * API hard-delete is available only for profiles without protected references;
 * a PlayerProfile with attendance or other history is archived instead. An
 * archived profile leaves the active catalogue and cannot enter new sessions.
 */
export function archivePlayer(id: number) {
  return api.updatePlayer(id, { player_profile: { status: "archived" } });
}

export function restorePlayer(id: number) {
  return api.updatePlayer(id, { player_profile: { status: "active" } });
}

export function archiveCoach(id: number) {
  return api.updateCoach(id, { coach_profile: { status: "archived" } });
}

export function restoreCoach(id: number) {
  return api.updateCoach(id, { coach_profile: { status: "active" } });
}

export function deletePlayerProfile(id: number) {
  return api.deletePlayer(id);
}

export function deleteCoachProfile(id: number) {
  return api.deleteCoach(id);
}

const PROFILE_DELETE_BLOCKER_LABELS: Record<string, string> = {
  profile_account: "the profile is linked to an account",
  person_account: "the linked Person has an account",
  person_group_memberships: "the linked identity is in a group roster",
  person_training_session_participants: "the linked Person has training history",
  person_assessment_session_participants: "the linked Person has assessment session history",
  person_assessments: "the linked Person has assessments",
  person_assessment_sessions: "the linked Person has assessment sessions",
  assessments: "the profile has assessments",
  training_session_participants: "the profile has training history",
  assessment_session_participants: "the profile has assessment session history",
  assessment_sessions: "the profile has assessment sessions",
  player_coaches: "the profile has coaching relationship history",
  ranking_consolidation_rows: "the profile appears in a ranking consolidation",
  ranking_snapshots: "the profile appears in a ranking snapshot",
  player_claims: "the profile has claim request history",
  claim_invitations: "the profile has invitation history",
  legacy_invitations: "the profile has invitation history",
  profile_merge_audit: "the profile is referenced by a merge audit",
  profile_merge_links: "the profile is part of a profile merge",
};

export function profileDeletionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const blockers = (error as Error & { blockers?: string[] }).blockers;
  if (!blockers?.length) return error.message;

  const details = [...new Set(blockers)].map((blocker) =>
    PROFILE_DELETE_BLOCKER_LABELS[blocker] ?? blocker.replaceAll("_", " "),
  );
  return `${error.message}: ${details.join("; ")}.`;
}

/** Reads the profile status off a payload that may or may not carry it. */
export function isArchived(
  profile: { status?: ProfileStatus | null } | null | undefined,
): boolean {
  return profile?.status === "archived";
}
