import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ClaimInvitation } from "../../api";

type SubjectType = "PlayerProfile" | "CoachProfile";
type ClaimableProfile = {
  type: SubjectType;
  id: number;
  name: string;
  path: string;
};

/** Staff view for issuing verified-email or open-link invitations. */
export default function ClaimInviteList() {
  const [profiles, setProfiles] = useState<ClaimableProfile[]>([]);
  const [invitations, setInvitations] = useState<ClaimInvitation[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [players, coaches, issuedInvitations] = await Promise.all([
      api.players({ mine: true, per_page: 100 }),
      api.coaches({ mine: true, per_page: 100 }),
      api.claimInvitations(),
    ]);
    const unlinkedPlayers = players.data
      .filter((profile) => profile.person_id === null && profile.status === "active")
      .map((profile): ClaimableProfile => ({
        type: "PlayerProfile", id: profile.id,
        name: profile.full_name?.trim() || profile.display_name || `Player profile #${profile.id}`,
        path: `/players/${profile.id}`,
      }));
    const unlinkedCoaches = coaches.data
      .filter((profile) => profile.person_id === null && profile.status === "active")
      .map((profile): ClaimableProfile => ({
        type: "CoachProfile", id: profile.id,
        name: profile.full_name?.trim() || profile.display_name || `Coach profile #${profile.id}`,
        path: `/coaches/${profile.id}`,
      }));
    return { profiles: [...unlinkedPlayers, ...unlinkedCoaches], invitations: issuedInvitations };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ profiles: available, invitations: rows }) => {
        if (cancelled) return;
        setProfiles(available);
        setInvitations(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load claimable profiles.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const invite = async (profile: ClaimableProfile) => {
    const key = `${profile.type}:${profile.id}`;
    setWorkingKey(key); setError(null);
    try {
      const created = await api.createClaimInvitation(profile.type, profile.id, emails[key]?.trim() || undefined);
      setIssued((old) => ({ ...old, [key]: created.token }));
      setInvitations(await api.claimInvitations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create an invitation.");
    } finally { setWorkingKey(null); }
  };

  const revoke = async (profile: ClaimableProfile, invitation: ClaimInvitation) => {
    const key = `${profile.type}:${profile.id}`;
    setWorkingKey(key); setError(null);
    try {
      await api.revokeClaimInvitation(invitation.id);
      setIssued((old) => { const next = { ...old }; delete next[key]; return next; });
      setInvitations(await api.claimInvitations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the invitation.");
    } finally { setWorkingKey(null); }
  };

  if (loading) return <p className="related-item-meta">Loading profiles…</p>;

  return <div className="identity-invite-list">
    {error && <div className="admin-error" role="alert">{error}</div>}
    {profiles.length === 0 ? <p className="related-item-meta">You have no unlinked profiles waiting to be claimed. Record a player or coach without a Person, and it will appear here.</p> : <ul>
      {profiles.map((profile) => {
        const key = `${profile.type}:${profile.id}`;
        const token = issued[key];
        const link = token ? `${window.location.origin}/identity#claim_token=${encodeURIComponent(token)}` : null;
        const active = invitations.find((row) => row.claimable_type === profile.type && row.claimable_id === profile.id && row.status === "active");
        return <li key={key} className="identity-invite-row">
          <div><strong>{profile.name}</strong> · <Link to={profile.path}>open profile</Link> · {profile.type === "PlayerProfile" ? "Player" : "Coach"}</div>
          {!link && <label className="auth-field">Recipient email (optional; exact verified match links immediately)
            <input type="email" value={emails[key] ?? ""} onChange={(event) => setEmails((old) => ({ ...old, [key]: event.target.value }))} placeholder="Leave blank for a review request" />
          </label>}
          {link ? <div role="status">
            <input aria-label={`Claim invitation link for ${profile.type} ${profile.id}`} readOnly value={link} />
            <button type="button" className="admin-btn" onClick={() => { void navigator.clipboard?.writeText(link); }}>Copy link</button>
          </div> : <button type="button" className="admin-btn admin-btn-add" disabled={workingKey === key} onClick={() => void invite(profile)}>
            {workingKey === key ? "Creating invitation…" : "Create claim invitation"}
          </button>}
          {active && <p className="related-item-meta">{active.invitee_email ? `Restricted to ${active.invitee_email}.` : "Open invitation; claim requires staff review."} Expires {new Date(active.expires_at).toLocaleDateString()}. The link is shown once and cannot be recovered.
            <button type="button" className="admin-btn" disabled={workingKey === key} onClick={() => void revoke(profile, active)}>Revoke</button>
          </p>}
        </li>;
      })}
    </ul>}
  </div>;
}
