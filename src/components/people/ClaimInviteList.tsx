import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Player, type PlayerClaimInvitation } from "../../api";

/**
 * The coach/admin side of claim invitations, reachable from /identity.
 *
 * This section exists because the invitation flow used to live only on a
 * player detail page reachable by exact URL, which made it undiscoverable.
 * It lists the viewer's own unlinked player profiles — the only profiles an
 * invitation can be issued against — and creates one in a click.
 */
export default function ClaimInviteList() {
  const [profiles, setProfiles] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [issued, setIssued] = useState<Record<number, string>>({});
  const [invitations, setInvitations] = useState<PlayerClaimInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // `mine=1` narrows to what this coach recorded; an admin may also issue
      // invitations, but the catalogue is the cheap shared source either way.
      const response = await api.players({ mine: true, per_page: 100 });
      setProfiles(
        response.data.filter((player) => player.person_id === null),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load player profiles.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (player: Player) => {
    setWorkingId(player.id);
    setError(null);
    try {
      const created = await api.createPlayerClaimInvitation(player.id);
      setIssued((old) => ({ ...old, [player.id]: created.token }));
      setInvitations(await api.playerClaimInvitations(player.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create an invitation.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  const revoke = async (invitation: PlayerClaimInvitation) => {
    setWorkingId(invitation.player_profile_id);
    setError(null);
    try {
      await api.revokePlayerClaimInvitation(invitation.id);
      setIssued((old) => {
        const next = { ...old };
        delete next[invitation.player_profile_id];
        return next;
      });
      setInvitations(await api.playerClaimInvitations(invitation.player_profile_id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke the invitation.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) return <p className="related-item-meta">Loading profiles…</p>;

  return (
    <div className="identity-invite-list">
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {profiles.length === 0 ? (
        <p className="related-item-meta">
          You have no player profiles waiting to be claimed. Record one without
          an account from Players → Record player, and it will appear here.
        </p>
      ) : (
        <ul>
          {profiles.map((player) => {
            const token = issued[player.id];
            const link = token
              ? `${window.location.origin}/identity#claim_token=${encodeURIComponent(token)}`
              : null;
            const existing = invitations.filter(
              (row) => row.player_profile_id === player.id && row.status === "active",
            );
            return (
              <li key={player.id} className="identity-invite-row">
                <div>
                  <strong>
                    {player.full_name?.trim() ||
                      player.display_name ||
                      `Player profile #${player.id}`}
                  </strong>{" "}
                  · <Link to={`/players/${player.id}`}>open profile</Link>
                </div>
                {link ? (
                  <div role="status">
                    <input
                      aria-label={`Claim invitation link for player ${player.id}`}
                      readOnly
                      value={link}
                    />
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => {
                        void navigator.clipboard?.writeText(link);
                      }}
                    >
                      Copy link
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-add"
                    disabled={workingId === player.id}
                    onClick={() => void invite(player)}
                  >
                    {workingId === player.id
                      ? "Creating invitation…"
                      : "Create claim invitation"}
                  </button>
                )}
                {existing.length > 0 && (
                  <p className="related-item-meta">
                    An invitation created {new Date(existing[0].created_at).toLocaleDateString()}{" "}
                    expires{" "}
                    {new Date(existing[0].expires_at).toLocaleDateString()}. Its
                    link was shown once and is not recoverable — create a new one
                    if it was lost.
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={workingId === player.id}
                      onClick={() => void revoke(existing[0])}
                    >
                      Revoke
                    </button>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}