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

/** Reads the profile status off a payload that may or may not carry it. */
export function isArchived(
  profile: { status?: ProfileStatus | null } | null | undefined,
): boolean {
  return profile?.status === "archived";
}
