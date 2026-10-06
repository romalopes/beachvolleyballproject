export const CLAIM_INVITATION_RETURN_PATH_KEY = "claimInvitationReturnPath";

/** Only accept an in-app path when restoring a claim invitation flow. */
export function safeInternalReturnPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export function rememberClaimInvitationPath(path: string): void {
  if (path.includes("claim_token=")) {
    window.localStorage.setItem(CLAIM_INVITATION_RETURN_PATH_KEY, path);
  }
}

export function clearClaimInvitationPath(): void {
  window.localStorage.removeItem(CLAIM_INVITATION_RETURN_PATH_KEY);
}
