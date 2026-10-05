import { useCallback, useEffect, useState } from "react";
import { api, type ClaimInvitation } from "../../api";

interface ClaimInvitationPanelProps {
  /** Which kind of record the invitation is about. */
  claimableType: ClaimInvitation["claimable_type"];
  claimableId: number;
  /**
   * Why the current viewer may not issue invitations, or null when they may.
   * The caller computes it from the same rule the API enforces
   * (`subject_owner?`: an admin, or the coach who recorded the profile).
   */
  blockedReason: string | null;
  /**
   * An address the invitation is restricted to. When the club emails it, the
   * recipient can be linked without a human reviewing the claim; otherwise the
   * request waits for staff review.
   */
  inviteeEmail: string | null;
}

/**
 * One-time claim invitations for an unlinked record.
 *
 * Three things this fixes, all of which made the original Phase 5 feature
 * unusable:
 *
 * 1. **Visibility of state.** The raw token is returned exactly once, so a
 *    page refresh used to lose it silently. The safe metadata is refetched on
 *    mount instead, so "is there a live invitation?" is always answerable.
 * 2. **Revocation.** `GET`/`revoke` already existed on the API and client but
 *    no screen called them.
 * 3. **Dead ends.** When invitations are unavailable the panel says *why*
 *    rather than rendering nothing.
 */
export default function ClaimInvitationPanel({
  claimableType,
  claimableId,
  blockedReason,
  inviteeEmail,
}: ClaimInvitationPanelProps) {
  const [invitations, setInvitations] = useState<ClaimInvitation[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // The list endpoint is owner/admin-only; a viewer who may not invite gets
    // a 403 here, which is not an error worth showing — `blockedReason` already
    // explains the situation.
    if (blockedReason) return;

    try {
      setInvitations(await api.claimInvitations(claimableType, claimableId));
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [claimableType, claimableId, blockedReason]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Derived rather than assigned in an effect: a blocked viewer never loads, so
  // there is nothing to wait for.
  const pending = loading && !blockedReason;

  const link = token
    ? `${window.location.origin}/identity#claim_token=${encodeURIComponent(token)}`
    : null;

  const create = async () => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.createClaimInvitation(
        claimableType,
        claimableId,
        inviteeEmail ?? undefined,
      );
      setToken(created.token);
      // The outcome differs: only a genuinely emailed invitation can be linked
      // without a human looking at it, so say which one the coach just made.
      setNotice(
        created.email_delivered
          ? `Invitation emailed to ${created.invitation.invitee_email}. Redeeming it links the profile immediately.`
          : inviteeEmail
            ? `Invitation created for ${inviteeEmail}, but the email could not be sent. Share the link instead — it will still need review.`
            : "Invitation created. Copy the link and share it — it will need review.",
      );
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create an invitation.",
      );
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (id: number) => {
    setWorking(true);
    setError(null);
    try {
      await api.revokeClaimInvitation(id);
      if (token) setToken(null);
      setNotice("Invitation revoked. The link no longer works.");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke the invitation.",
      );
    } finally {
      setWorking(false);
    }
  };
  if (blockedReason) {
    return (
      <div className="identity-invitation">
        <p className="related-item-meta">{blockedReason}</p>
      </div>
    );
  }

  const active = invitations.filter((row) => row.status === "active");

  return (
    <div className="identity-invitation">
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {notice && !token && (
        <p className="related-item-meta" role="status">
          {notice}
        </p>
      )}

      {link ? (
        <div role="status">
          <p className="related-item-meta">
            {inviteeEmail
              ? `This one-time link can only be redeemed by ${inviteeEmail}. `
              : "Copy this one-time link and share it with the player. "}
            The token is shown only now.
          </p>
          <input aria-label="Claim invitation link" readOnly value={link} />
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => setToken(null)}
          >
            Hide token
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn-add"
          disabled={working || pending}
          onClick={() => void create()}
        >
          {working ? "Creating invitation…" : "Create claim invitation"}
        </button>
      )}
      {!pending && invitations.length > 0 && (
        <table className="identity-invitation-list">
          <caption className="related-item-meta">
            Invitation history. Only one invitation is active at a time.
          </caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Address</th>
              <th scope="col">Expires</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((row) => (
              <tr key={row.id}>
                <td>{row.status}</td>
                <td>{row.invitee_email ?? "Anyone with the link"}</td>
                <td>{new Date(row.expires_at).toLocaleDateString()}</td>
                <td>
                  {row.status === "active" && (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={working}
                      onClick={() => void revoke(row.id)}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!pending && active.length === 0 && (
        <p className="related-item-meta">
          No active invitation. Creating one revokes any previous link.
        </p>
      )}
    </div>
  );
}