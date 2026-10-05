import { useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { api, type ClaimInvitation } from "../../api";

interface ProfileInviteLinkButtonProps {
  claimableType: Extract<ClaimInvitation["claimable_type"], "PlayerProfile" | "CoachProfile">;
  claimableId: number;
  profileName: string;
}

/** Create a one-time claim link directly from a player or coach catalogue row. */
export default function ProfileInviteLinkButton({
  claimableType,
  claimableId,
  profileName,
}: ProfileInviteLinkButtonProps) {
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const create = async () => {
    setWorking(true);
    setError(null);
    setLink(null);
    setNotice(null);
    try {
      const created = await api.createClaimInvitation(claimableType, claimableId);
      setLink(`${window.location.origin}/identity#claim_token=${encodeURIComponent(created.token)}`);
      setNotice(
        created.email_delivered
          ? `Invitation emailed to ${created.invitation.invitee_email}. A verified matching account can connect immediately.`
          : created.invitation.invitee_email
            ? `Email delivery failed. Share this link only with ${created.invitation.invitee_email}; their verified account can connect immediately.`
            : "No email is on file. Anyone with the link can request the profile, and staff must approve the request.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create an invitation.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="profile-invite-action">
      <button
        type="button"
        className="admin-btn admin-btn-add"
        disabled={working}
        aria-label={`Create new invite link for ${profileName}`}
        onClick={() => void create()}
      >
        <Link2 size={14} /> {working ? "Creating…" : "Create new invite link"}
      </button>
      {notice && <p className="related-item-meta" role="status">{notice}</p>}
      {link && (
        <div className="profile-invite-link" role="status">
          <input aria-label={`Invite link for ${profileName}`} readOnly value={link} />
          <button
            type="button"
            className="admin-btn"
            onClick={() => void navigator.clipboard?.writeText(link)}
          >
            <Copy size={14} /> Copy link
          </button>
          <p className="related-item-meta">
            Copy and share this one-time link. The recipient can request this profile
            after signing in, and staff must approve the request. The token is shown
            only now; creating another link will revoke this one.
          </p>
        </div>
      )}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
  );
}
