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
 * Archiving is the only removal path: profiles are never hard-deleted, because
 * a PlayerProfile owns the training history (`dependent: :destroy` would take
 * the attendance with it). An archived profile disappears from the catalogue and
 * cannot be added to new sessions, but keeps every past one.
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
