import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ClaimInvitation, type ManagementClaim, type ManagementClaimableProfile, type PaginationMeta } from "../../api";

type Tab = "claims" | "invitations";

/** Role-gated management views. All record scopes and filters are enforced by the API. */
export default function ProfileManagementDashboard() {
  const [tab, setTab] = useState<Tab>("claims");
  const [claimType, setClaimType] = useState("all");
  const [claimStatus, setClaimStatus] = useState("pending");
  const [invitationType, setInvitationType] = useState("all");
  const [invitationStatus, setInvitationStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [claims, setClaims] = useState<ManagementClaim[]>([]);
  const [invitations, setInvitations] = useState<ClaimInvitation[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [profiles, setProfiles] = useState<ManagementClaimableProfile[]>([]);
  const [profileType, setProfileType] = useState("all");
  const [profileStatus, setProfileStatus] = useState("active");
  const [linkState, setLinkState] = useState("unlinked");
  const [profileQuery, setProfileQuery] = useState("");
  const [profilePage, setProfilePage] = useState(1);
  const [profileMeta, setProfileMeta] = useState<PaginationMeta | null>(null);
  const [verification, setVerification] = useState<"" | "staff_confirmed" | "government_id" | "in_person" | "other">("");
  const [reason, setReason] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [newLinks, setNewLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadManagementList = async () => {
    setLoading(true); setError(null);
    try {
      if (tab === "claims") {
        const response = await api.managementPlayerClaims({ status: claimStatus, claimableType: claimType, page, perPage: 20 });
        setClaims(response.data); setMeta(response.meta);
      } else {
        const response = await api.managementClaimInvitations({ status: invitationStatus, claimableType: invitationType, page, perPage: 20 });
        // Person invitations are retained as legacy records during cutover, but
        // the active workflow now manages profile invitations only.
        setInvitations(response.data.filter((item) => item.claimable_type !== "Person")); setMeta(response.meta);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load profile management records."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadManagementList(); }, [tab, claimType, claimStatus, invitationType, invitationStatus, page]);

  useEffect(() => {
    if (tab !== "invitations") return;
    let cancelled = false;
    setProfileLoading(true); setError(null);
    api.managementClaimables({ claimableType: profileType, status: profileStatus, linkState, q: profileQuery, page: profilePage, perPage: 20 })
      .then((response) => { if (!cancelled) { setProfiles(response.data); setProfileMeta(response.meta); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load profiles in your scope."); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [tab, profileType, profileStatus, linkState, profileQuery, profilePage]);

  const review = async (claim: ManagementClaim, action: "approve" | "reject") => {
    setBusy(claim.id); setError(null); setNotice(null);
    try {
      if (action === "approve") {
        if (!verification) throw new Error("Choose how the claimant's identity was verified.");
        await api.approvePlayerClaim(claim.id, verification);
      } else await api.rejectPlayerClaim(claim.id, reason.trim());
      setNotice(`Claim #${claim.id} ${action === "approve" ? "approved" : "rejected"}.`);
      await loadManagementList();
    } catch (err) { setError(err instanceof Error ? err.message : `Could not ${action} claim.`); }
    finally { setBusy(null); }
  };

  const issue = async (profile: ManagementClaimableProfile, prior?: ClaimInvitation) => {
    const key = `${profile.claimable_type}:${profile.claimable_id}`;
    setBusy(key); setError(null); setNotice(null);
    try {
      const result = await api.createClaimInvitation(profile.claimable_type, profile.claimable_id, emails[key]?.trim() || prior?.invitee_email || undefined);
      const link = `${window.location.origin}/identity#claim_token=${encodeURIComponent(result.token)}`;
      setNewLinks((old) => ({ ...old, [result.invitation.id]: link, [key]: link }));
      setNotice(result.email_delivered ? "A replacement invitation was emailed. The new link is also available to copy." : "A new invitation link is ready to copy.");
      await loadManagementList();
      const directory = await api.managementClaimables({ claimableType: profileType, status: profileStatus, linkState, q: profileQuery, page: profilePage, perPage: 20 });
      setProfiles(directory.data); setProfileMeta(directory.meta);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the invitation."); }
    finally { setBusy(null); }
  };

  const revoke = async (invitation: ClaimInvitation) => {
    setBusy(invitation.id); setError(null); setNotice(null);
    try { await api.revokeClaimInvitation(invitation.id); setNotice(`Invitation #${invitation.id} cancelled.`); await loadManagementList(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not cancel invitation."); }
    finally { setBusy(null); }
  };

  const currentActive = useMemo(() => new Map(invitations.filter((row) => row.status === "active").map((row) => [`${row.claimable_type}:${row.claimable_id}`, row])), [invitations]);

  return <section className="detail-section profile-management-dashboard" aria-labelledby="profile-management-heading">
    <h2 id="profile-management-heading">Profile management</h2>
    <p>Manage claims and invitations only for profiles available to your role. Coach approval remains limited to profiles you recorded.</p>
    {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
    {notice && <div className="auth-flash auth-flash-notice" role="status">{notice}</div>}
    <div role="tablist" aria-label="Profile management views">
      <button role="tab" aria-selected={tab === "claims"} onClick={() => { setTab("claims"); setPage(1); }}>Claims</button>
      <button role="tab" aria-selected={tab === "invitations"} onClick={() => { setTab("invitations"); setPage(1); }}>Invitations</button>
    </div>

    {tab === "claims" ? <>
      <div className="profile-management-filters">
        <label className="auth-field">Profile type<select aria-label="Claim profile type" value={claimType} onChange={(event) => { setClaimType(event.target.value); setPage(1); }}><option value="all">All profiles</option><option value="PlayerProfile">Players</option><option value="CoachProfile">Coaches</option></select></label>
        <label className="auth-field">Claim status<select aria-label="Claim status" value={claimStatus} onChange={(event) => { setClaimStatus(event.target.value); setPage(1); }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="all">All history</option></select></label>
      </div>
      {loading ? <p role="status">Loading claims…</p> : claims.length ? <>
        <ul>{claims.map((claim) => <li key={claim.id}>
          <strong>Claim #{claim.id}</strong> · {claim.player_name || `${claim.claimable_type || "Profile"} #${claim.claimable_id ?? claim.player_profile_id}`} · {claim.status}
          {claim.verification_method && <span> · Verified by {claim.verification_method.replaceAll("_", " ")}</span>}
          {claim.rejection_reason && <p>Decision note: {claim.rejection_reason}</p>}
          {claim.status === "pending" && claim.can_review && <div className="profile-management-actions">
            <label className="auth-field">Verification method<select aria-label={`Verification method for claim ${claim.id}`} value={verification} onChange={(event) => setVerification(event.target.value as typeof verification)}><option value="">Choose a method</option><option value="staff_confirmed">Staff confirmed</option><option value="government_id">Government ID checked</option><option value="in_person">Confirmed in person</option><option value="other">Other</option></select></label>
            <label className="auth-field">Rejection reason (optional)<input aria-label={`Rejection reason for claim ${claim.id}`} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button className="admin-btn" disabled={busy === claim.id || !verification} onClick={() => void review(claim, "approve")}>Approve</button>
            <button className="admin-btn" disabled={busy === claim.id} onClick={() => void review(claim, "reject")}>Reject</button>
          </div>}
        </li>)}</ul>
        <Pager meta={meta} page={page} setPage={setPage} />
      </> : <p>No claims match these filters.</p>}
    </> : <>
      <h3>Profiles in your authorized scope</h3>
      <div className="profile-management-filters">
        <label className="auth-field">Profile type<select aria-label="Invitation profile type" value={profileType} onChange={(event) => { setProfileType(event.target.value); setProfilePage(1); }}><option value="all">Players and coaches</option><option value="PlayerProfile">Players</option><option value="CoachProfile">Coaches</option></select></label>
        <label className="auth-field">Profile status<select aria-label="Profile status" value={profileStatus} onChange={(event) => { setProfileStatus(event.target.value); setProfilePage(1); }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All statuses</option></select></label>
        <label className="auth-field">Account link<select aria-label="Profile account link status" value={linkState} onChange={(event) => { setLinkState(event.target.value); setProfilePage(1); }}><option value="unlinked">Unlinked profiles</option><option value="linked">Linked profiles</option><option value="all">All profiles</option></select></label>
        <label className="auth-field">Search profiles<input aria-label="Search managed profiles" value={profileQuery} onChange={(event) => { setProfileQuery(event.target.value); setProfilePage(1); }} /></label>
      </div>
      {profileLoading ? <p role="status">Loading profiles…</p> : profiles.length ? <ul>{profiles.map((profile) => {
        const key = `${profile.claimable_type}:${profile.claimable_id}`;
        const prior = currentActive.get(key);
        const label = profile.claimable_type === "PlayerProfile" ? "Player" : "Coach";
        const path = profile.claimable_type === "PlayerProfile" ? `/players/${profile.claimable_id}` : `/coaches/${profile.claimable_id}`;
        return <li key={key}>
          <Link to={path}>{profile.display_name || `${label} profile #${profile.claimable_id}`}</Link> · {label} · {profile.status} · {profile.linked_to_account ? "Account linked" : "Unlinked"}
          {profile.can_invite && !profile.linked_to_account && <div className="profile-management-actions">
            <label className="auth-field">Recipient email (new or existing account)<input type="email" aria-label={`Recipient email for ${label.toLowerCase()} profile ${profile.claimable_id}`} value={emails[key] ?? ""} onChange={(event) => setEmails((old) => ({ ...old, [key]: event.target.value }))} placeholder="Optional; verified match links immediately" /></label>
            <button className="admin-btn" disabled={busy === key} onClick={() => void issue(profile, prior)}>{busy === key ? "Creating link…" : prior ? "Create new invite link" : "Create invite link"}</button>
            {prior && <span>Active invitation · expires {new Date(prior.expires_at).toLocaleDateString()}</span>}
            {newLinks[key] && <div role="status"><label className="auth-field">New invitation link for {label.toLowerCase()} profile {profile.claimable_id}<input aria-label={`New invitation link for ${label.toLowerCase()} profile ${profile.claimable_id}`} readOnly value={newLinks[key]} /></label><button className="admin-btn" onClick={() => { void navigator.clipboard?.writeText(newLinks[key]); }}>Copy link</button></div>}
          </div>}
        </li>;
      })}</ul> : <p>No profiles match these filters.</p>}
      <Pager meta={profileMeta} page={profilePage} setPage={setProfilePage} />
      <h3>Invitation history</h3>
      <div className="profile-management-filters">
        <label className="auth-field">Invitation profile type<select aria-label="Invitation history profile type" value={invitationType} onChange={(event) => { setInvitationType(event.target.value); setPage(1); }}><option value="all">All profiles</option><option value="PlayerProfile">Players</option><option value="CoachProfile">Coaches</option></select></label>
        <label className="auth-field">Invitation status<select aria-label="Invitation status" value={invitationStatus} onChange={(event) => { setInvitationStatus(event.target.value); setPage(1); }}><option value="all">All history</option><option value="active">Active</option><option value="used">Accepted</option><option value="declined">Declined</option><option value="revoked">Cancelled</option><option value="expired">Expired</option></select></label>
      </div>
      {loading ? <p role="status">Loading invitation history…</p> : invitations.length ? <>
        <ul>{invitations.map((invitation) => {
          if (invitation.claimable_type === "Person") return null;
          const profile: ManagementClaimableProfile = { claimable_type: invitation.claimable_type, claimable_id: invitation.claimable_id, display_name: invitation.claimable_name || "Profile", status: "active", linked_to_account: false, can_invite: true };
          const replacementEligible = invitation.status === "active";
          return <li key={invitation.id}>
            <strong>{invitation.claimable_name || `${invitation.claimable_type} #${invitation.claimable_id}`}</strong> · {invitation.invitee_email || "Open link"} · {invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}
            {invitation.status === "active" && <button className="admin-btn" disabled={busy === invitation.id} onClick={() => void revoke(invitation)}>Cancel invitation</button>}
            {replacementEligible && <button className="admin-btn" disabled={busy !== null} onClick={() => void issue(profile, invitation)}>Resend / replace invitation</button>}
            {newLinks[String(invitation.id)] && <div role="status"><label className="auth-field">New invitation link<input aria-label={`New invitation link ${invitation.id}`} readOnly value={newLinks[String(invitation.id)]} /></label><button className="admin-btn" onClick={() => { void navigator.clipboard?.writeText(newLinks[String(invitation.id)]); }}>Copy link</button></div>}
          </li>;
        })}</ul>
        <Pager meta={meta} page={page} setPage={setPage} />
      </> : <p>No invitations match these filters.</p>}
    </>}
  </section>;
}

function Pager({ meta, page, setPage }: { meta: PaginationMeta | null; page: number; setPage: (update: (page: number) => number) => void }) {
  if (!meta || meta.total_pages < 2) return null;
  return <nav aria-label="Management result pages"><button className="admin-btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button> Page {page} of {meta.total_pages} <button className="admin-btn" disabled={page >= meta.total_pages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>;
}
