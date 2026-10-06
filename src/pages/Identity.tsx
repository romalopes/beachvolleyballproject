import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type ClaimInvitation, type MembershipConflictResolution, type PersonConsolidationConflict, type PersonIdentity, type PlayerClaim, type PlayerProfileCandidate, type PaginationMeta } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import ProfileManagementDashboard from "../components/identity/ProfileManagementDashboard";
import { clearClaimInvitationPath, rememberClaimInvitationPath } from "../auth/invitationReturnPath";

type ResolutionChoice = { keep_record_id: number; reason: string };

/** Self-service identity context and the claim workflows supported by the API. */
export default function IdentityPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<PlayerProfileCandidate[]>([]);
  const [candidateMeta, setCandidateMeta] = useState<PaginationMeta | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [confirmClaims, setConfirmClaims] = useState(false);
  const [receivedInvitations, setReceivedInvitations] = useState<ClaimInvitation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileType, setProfileType] = useState<"PlayerProfile" | "CoachProfile">("PlayerProfile");
  const [claims, setClaims] = useState<PlayerClaim[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  const loading = Boolean(user) && loadedUserId !== user?.id;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(() => {
    const fragmentToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("claim_token");
    return fragmentToken ?? searchParams.get("claim_token") ?? "";
  });
  const [accountToken, setAccountToken] = useState(() => {
    const fragmentToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("account_claim_token");
    return fragmentToken ?? searchParams.get("account_claim_token") ?? "";
  });

  const canManageProfiles = Boolean(user?.roles.some((role) => role === "admin" || role === "coach" || role === "curator"));
  const isAdmin = Boolean(user?.roles.includes("admin"));
  const userId = user?.id;
  const personId = user?.person_id;
  const invitationReturnPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (token) rememberClaimInvitationPath(invitationReturnPath);
  }, [token, invitationReturnPath]);

  const reloadClaims = async () => {
    const mine = await api.playerClaims();
    setClaims(mine.filter((claim) => claim.person_id === user?.person_id));
    setReceivedInvitations(await api.receivedClaimInvitations());
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([api.playerClaims(), api.receivedClaimInvitations()]).then(([userClaims, received]) => {
      if (cancelled) return;
      setClaims(userClaims.filter((claim) => claim.person_id === personId));
      setReceivedInvitations(received);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load identity information.");
    }).finally(() => { if (!cancelled) setLoadedUserId(userId); });
    return () => { cancelled = true; };
  }, [userId, personId]);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    setCandidateLoading(true); setCandidateError(null);
    api.searchProfileCandidates({ type: profileType, q: submittedQuery, organisationId: organisationId ? Number(organisationId) : undefined, page: candidatePage, perPage: 20 })
      .then((result) => { if (!cancelled) { setCandidates(result.data); setCandidateMeta(result.meta); } })
      .catch((err: unknown) => { if (!cancelled) { setCandidates([]); setCandidateMeta(null); setCandidateError(err instanceof Error ? err.message : "Could not search profiles."); } })
      .finally(() => { if (!cancelled) setCandidateLoading(false); });
    return () => { cancelled = true; };
  }, [personId, profileType, submittedQuery, organisationId, candidatePage]);

  const redeem = async () => {
    if (!token.trim()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api.redeemClaimInvitation(token.trim());
      // An exact verified email links now; an open profile link becomes a
      // request for staff review.
      setNotice(
        result.outcome === "linked"
          ? "Your profile is now linked to your account."
          : result.message,
      );
      setToken("");
      clearClaimInvitationPath();
      const next = new URLSearchParams(searchParams);
      next.delete("claim_token");
      navigate({ pathname: location.pathname, search: next.toString() ? `?${next}` : "", hash: "" }, { replace: true });
      await reloadClaims();
    } catch (err) { setError(err instanceof Error ? err.message : "Invitation could not be redeemed."); }
    finally { setBusy(false); }
  };

  const redeemAccountInvitation = async () => {
    if (!accountToken.trim()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api.redeemPersonAccountInvitation(accountToken.trim());
      setAccountToken("");
      navigate({ pathname: location.pathname, search: "", hash: "" }, { replace: true });
      setNotice(`Your account is now linked to ${result.person.full_name}. Refresh the page to load the updated identity.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Account invitation could not be accepted."); }
    finally { setBusy(false); }
  };

  const submitClaims = async () => {
    if (!selected.length) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const results = await Promise.allSettled(selected.map((key) => {
        const [type, rawId] = key.split(":");
        return type === "CoachProfile"
          ? api.requestProfileClaim("CoachProfile", Number(rawId))
          : api.requestPlayerClaim(Number(rawId));
      }));
      const requested = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (requested.length) setClaims((old) => [...requested, ...old]);
      setSelected([]);
      setConfirmClaims(false);
      if (requested.length) setNotice(`${requested.length} claim request${requested.length === 1 ? "" : "s"} submitted. Matches are suggestions and still need review.`);
      const rejected = results.find((result) => result.status === "rejected");
      if (rejected?.status === "rejected") setError(rejected.reason instanceof Error ? rejected.reason.message : "One or more claim requests could not be submitted.");
    } catch (err) { setError(err instanceof Error ? err.message : "Claim requests could not be submitted."); }
    finally { setBusy(false); }
  };

  const invitationAction = async (invitation: ClaimInvitation, action: "accept" | "decline") => {
    setBusy(true); setError(null); setNotice(null);
    try {
      if (action === "accept") {
        const result = await api.acceptReceivedClaimInvitation(invitation.id);
        setNotice(result.outcome === "linked" ? "Invitation accepted. The profile is now linked to your account." : result.message);
      } else {
        await api.declineReceivedClaimInvitation(invitation.id);
        setNotice("Invitation declined.");
      }
      await reloadClaims();
    } catch (err) { setError(err instanceof Error ? err.message : `Could not ${action} invitation.`); }
    finally { setBusy(false); }
  };

  const actOnClaim = async (claim: PlayerClaim) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await api.cancelPlayerClaim(claim.id);
      await reloadClaims();
      setNotice(`Claim ${claim.id} cancelled.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not cancel claim."); }
    finally { setBusy(false); }
  };

  if (!user) return <div className="page"><EmptyState title="Sign in to view your identity" description="Sign in or create an account to redeem this invitation. The invitation link will be restored after email verification." /><Link className="auth-submit" to="/login" state={{ from: invitationReturnPath }}>Sign in</Link></div>;
  if (loading) return <div className="loading">Loading identity…</div>;

  return <div className="page identity-page">
    <header className="page-header"><h1>Identity</h1><p>Your account, profiles, memberships, and player claim requests.</p></header>
    {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
    {notice && <div className="auth-flash auth-flash-notice" role="status">{notice}</div>}

    <section className="detail-section" aria-labelledby="account-context-heading">
      <h2 id="account-context-heading">Account</h2>
      <dl className="identity-context"><dt>Account</dt><dd>{user.account_id ? `#${user.account_id}` : "No linked account"}</dd><dt>Person</dt><dd>{user.person_id ? `#${user.person_id}` : "No linked Person"}</dd></dl>
    </section>
    {accountToken && <section className="detail-section"><h2>Connect to your recorded Person</h2>
      <p>Accepting this invitation connects your verified email account to the Person already recorded by the club. Their player and coach profiles stay with that Person.</p>
      <label className="auth-field">Invitation token<input aria-label="Account invitation token" value={accountToken} onChange={(event) => setAccountToken(event.target.value)} autoComplete="off" /></label>
      <button className="auth-submit" disabled={busy || !accountToken.trim()} onClick={() => void redeemAccountInvitation()}>{busy ? "Connecting…" : "Accept account invitation"}</button>
      {notice?.includes("Refresh the page") && <button className="admin-btn" onClick={() => window.location.reload()}>Refresh identity</button>}
    </section>}
    <section className="detail-section"><h2>Player profiles</h2>
      {user.player_profiles?.length ? <ul>{user.player_profiles.map((profile) => <li key={profile.id}>{profile.display_name || `Player profile #${profile.id}`} · {profile.status}{profile.level ? ` · ${profile.level}` : ""}</li>)}</ul> : <p>No player profiles are linked to this account.</p>}
    </section>
    <section className="detail-section"><h2>Coach profiles</h2>
      {user.coach_profiles?.length ? <ul>{user.coach_profiles.map((profile) => <li key={profile.id}>Coach profile #{profile.id} · {profile.coaching_level || "Level not set"} · {profile.status}</li>)}</ul> : <p>No coach profiles are linked to this account.</p>}
    </section>
    <section className="detail-section"><h2>Organisation memberships</h2>
      {user.organisation_memberships?.length ? <ul>{user.organisation_memberships.map((membership) => <li key={membership.id}>{membership.organisation?.name || `Organisation #${membership.organisation_id}`} · {membership.role} · {membership.status}</li>)}</ul> : <p>No organisation memberships.</p>}
    </section>
    <section className="detail-section"><h2>Group memberships</h2>
      {user.group_memberships?.length ? <ul>{user.group_memberships.map((membership) => <li key={membership.id}>{membership.group.name} · {membership.role} · {membership.status}{membership.group.organisation ? ` · ${membership.group.organisation.name}` : ""}</li>)}</ul> : <p>No group memberships.</p>}
    </section>

    <section className="detail-section"><h2>Redeem a claim invitation</h2><p>A verified email matching the invitation links you to the recorded Person or profile. An open link without a matching email is sent to a coach or administrator to review.</p>
      <label className="auth-field">Invitation token<input aria-label="Invitation token" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" /></label>
      <button className="auth-submit" disabled={busy || !token.trim()} onClick={() => void redeem()}>{busy ? "Submitting…" : "Redeem invitation"}</button>
    </section>

    <section className="detail-section"><h2>Claim profiles</h2>
      {!personId ? (
        <p role="note">
          Your account has no linked Person, so the club cannot match you to profile
          suggestions yet. Ask a coach or administrator to create an invite link
          from your player or coach profile, then redeem it above while signed in.
          If the link is tied to your recorded email, verify that email first.
        </p>
      ) : (
        <>
          <p>Suggestions are limited to profiles in your organisation or connected through a current coach relationship. A match is only a suggestion; your request will be reviewed.</p>
          <div role="tablist" aria-label="Profile type"><button role="tab" aria-selected={profileType === "PlayerProfile"} onClick={() => { setProfileType("PlayerProfile"); setSelected([]); setCandidatePage(1); }}>Players</button><button role="tab" aria-selected={profileType === "CoachProfile"} onClick={() => { setProfileType("CoachProfile"); setSelected([]); setCandidatePage(1); }}>Coaches</button></div>
          <div className="identity-candidate-search">
            <label className="auth-field">Search by name<input aria-label="Search profiles by name" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setSubmittedQuery(candidateQuery); setCandidatePage(1); } }} /></label>
            {(user.organisation_memberships ?? []).some((membership) => membership.status === "active") && <label className="auth-field">Organisation<select aria-label="Filter by organisation" value={organisationId} onChange={(event) => { setOrganisationId(event.target.value); setCandidatePage(1); }}><option value="">All eligible organisations</option>{(user.organisation_memberships ?? []).filter((membership) => membership.status === "active").map((membership) => <option key={membership.organisation_id} value={membership.organisation_id}>{membership.organisation?.name || `Organisation #${membership.organisation_id}`}</option>)}</select></label>}
            <button className="admin-btn" onClick={() => { setSubmittedQuery(candidateQuery); setCandidatePage(1); }}>Search</button>
          </div>
          {candidateLoading ? <p role="status">Searching eligible profiles…</p> : candidateError ? <p role="alert">{candidateError}</p> : candidates.length ? <ul>
            {candidates.map((candidate) => {
              const type = candidate.claimable_type ?? "PlayerProfile";
              const id = candidate.claimable_id ?? candidate.player_profile_id ?? candidate.coach_profile_id ?? candidate.id;
              const key = `${type}:${id}`;
              const existingClaim = claims.find((claim) => claim.claimable_type === type && claim.claimable_id === id && ["pending", "approved"].includes(claim.status));
              return <li key={key}>
                {existingClaim ? <span>{candidate.display_name} · Claim {existingClaim.status}</span> : <label><input type="checkbox" checked={selected.includes(key)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, key] : ids.filter((id) => id !== key))} /> {candidate.display_name} · {candidate.match_type.replaceAll("_", " ")} · Suggested match</label>}
              </li>;
            })}
          </ul> : <p>{submittedQuery.length > 0 && submittedQuery.length < 3 ? "Enter at least 3 characters to search." : "No eligible profiles found. Try another name or ask a coach or administrator for an invite link."}</p>}
          {candidateMeta && candidateMeta.total_pages > 1 && <nav aria-label="Profile search pages"><button className="admin-btn" disabled={candidatePage <= 1 || candidateLoading} onClick={() => setCandidatePage((page) => page - 1)}>Previous</button><span>Page {candidateMeta.page} of {candidateMeta.total_pages}</span><button className="admin-btn" disabled={candidatePage >= candidateMeta.total_pages || candidateLoading} onClick={() => setCandidatePage((page) => page + 1)}>Next</button></nav>}
          <button className="auth-submit" disabled={busy || selected.length === 0} onClick={() => setConfirmClaims(true)}>Review selected claims ({selected.length})</button>
          {confirmClaims && <div role="group" aria-label="Confirm claim requests"><p>Submit {selected.length} claim request{selected.length === 1 ? "" : "s"}? A coach or administrator must approve each request before a profile is linked.</p><button className="auth-submit" disabled={busy} onClick={() => void submitClaims()}>Submit claim request{selected.length === 1 ? "" : "s"}</button><button className="admin-btn" disabled={busy} onClick={() => setConfirmClaims(false)}>Cancel</button></div>}
        </>
      )}
    </section>

    <section className="detail-section"><h2>My claim requests</h2>
      {claims.length ? <ul>{claims.map((claim) => <li key={claim.id}>Claim #{claim.id} · {claim.claimable_type?.replace("Profile", " profile ") || "Profile"} #{claim.claimable_id ?? claim.player_profile_id ?? "—"} · {claim.status}{claim.status === "pending" && <button className="admin-btn" disabled={busy} onClick={() => void actOnClaim(claim)}>Cancel request</button>}</li>)}</ul> : <p>You have no claim requests.</p>}
    </section>

    <section className="detail-section"><h2>Invitations received</h2>
      {receivedInvitations.length ? <ul>{receivedInvitations.map((invitation) => <li key={invitation.id}>{invitation.claimable_type.replace("Profile", " profile ")} #{invitation.claimable_id} · {invitation.status}{invitation.status === "active" && <><button className="admin-btn" disabled={busy} onClick={() => void invitationAction(invitation, "accept")}>Accept</button><button className="admin-btn" disabled={busy} onClick={() => void invitationAction(invitation, "decline")}>Decline</button></>}</li>)}</ul> : <p>No invitations have been sent to your verified account email.</p>}
    </section>

    <section className="detail-section"><h2>Claim and invitation history</h2>
      {claims.some((claim) => claim.status !== "pending") || receivedInvitations.some((invitation) => invitation.status !== "active") ? <ul>{claims.filter((claim) => claim.status !== "pending").map((claim) => <li key={`claim-${claim.id}`}>Claim #{claim.id} · {claim.claimable_type?.replace("Profile", " profile ") || "Profile"} · {claim.status}{claim.reviewed_at ? ` · ${new Date(claim.reviewed_at).toLocaleDateString()}` : ""}</li>)}{receivedInvitations.filter((invitation) => invitation.status !== "active").map((invitation) => <li key={`invitation-${invitation.id}`}>Invitation #{invitation.id} · {invitation.claimable_type.replace("Profile", " profile ")} · {invitation.status}</li>)}</ul> : <p>No claim or invitation history yet.</p>}
    </section>

    {canManageProfiles && <ProfileManagementDashboard />}
    {isAdmin && <PersonConsolidation />}
  </div>;
}

function PersonConsolidation() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonIdentity[]>([]);
  const [source, setSource] = useState(0);
  const [canonical, setCanonical] = useState(0);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.personConsolidationPreview>> | null>(null);
  const [choices, setChoices] = useState<Record<string, ResolutionChoice>>({});
  const [auditId, setAuditId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const conflicts = useMemo(() => preview?.conflicts.filter((item) => item.type !== "account_conflict") ?? [], [preview]);

  const search = async () => { setError(null); try { setPeople(await api.people({ q: query })); } catch (err) { setError(err instanceof Error ? err.message : "Could not search people."); } };
  const loadPreview = async () => { setBusy(true); setError(null); setResult(null); try { setPreview(await api.personConsolidationPreview(source, canonical)); setChoices({}); } catch (err) { setPreview(null); setError(err instanceof Error ? err.message : "Could not preview consolidation."); } finally { setBusy(false); } };
  const execute = async () => {
    if (!preview) return;
    setBusy(true); setError(null);
    try {
      let audit;
      if (conflicts.length) {
        const resolutions: MembershipConflictResolution[] = conflicts.map((conflict: PersonConsolidationConflict) => ({ type: conflict.type as MembershipConflictResolution["type"], container_id: conflict.container_id!, keep_record_id: choices[conflictKey(conflict)].keep_record_id, reason: choices[conflictKey(conflict)].reason.trim() }));
        audit = await api.resolvePersonConsolidation(source, canonical, resolutions);
      } else audit = await api.consolidatePeople(source, canonical);
      setResult(JSON.stringify(audit, null, 2)); setPreview(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Consolidation was not completed."); }
    finally { setBusy(false); }
  };
  const loadAudit = async () => { setBusy(true); setError(null); try { setResult(JSON.stringify(await api.personConsolidation(Number(auditId)), null, 2)); } catch (err) { setError(err instanceof Error ? err.message : "Could not load consolidation audit."); } finally { setBusy(false); } };
  const canExecute = Boolean(preview && !preview.conflicts.some((conflict) => conflict.type === "account_conflict") && conflicts.every((conflict) => choices[conflictKey(conflict)]?.keep_record_id && choices[conflictKey(conflict)]?.reason.trim()));

  return <section className="detail-section"><h2>Person consolidation</h2><p>Administrative tool to preview duplicate Person records, resolve membership conflicts, and retain an audit record. Account conflicts block consolidation.</p>
    {error && <div className="auth-flash auth-flash-error" role="alert">{error}</div>}
    <div className="auth-field"><label htmlFor="consolidation-search">Find people</label><input id="consolidation-search" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="admin-btn" disabled={busy || !query.trim()} onClick={() => void search()}>Search</button></div>
    {people.length > 0 && <div className="identity-pair-picker"><label>Source record<select value={source} onChange={(event) => setSource(Number(event.target.value))}><option value={0}>Choose a source</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name} · #{person.id}</option>)}</select></label><label>Keep this Person<select value={canonical} onChange={(event) => setCanonical(Number(event.target.value))}><option value={0}>Choose canonical record</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name} · #{person.id}</option>)}</select></label><button className="admin-btn" disabled={busy || !source || !canonical || source === canonical} onClick={() => void loadPreview()}>Preview</button></div>}
    {preview && <div className="identity-preview"><h3>{preview.source_person.full_name} → {preview.canonical_person.full_name}</h3><p>{preview.ready ? "Ready to consolidate." : "Review conflicts before continuing."}</p>
      {preview.conflicts.length === 0 ? <p>No conflicts found.</p> : <ul>{preview.conflicts.map((conflict) => <li key={conflictKey(conflict)}>{conflict.type.replaceAll("_", " ")} · records #{conflict.source_record_id} and #{conflict.canonical_record_id}{conflict.type === "account_conflict" ? <strong> Account conflict blocks this action.</strong> : <div><label>Keep record<select value={choices[conflictKey(conflict)]?.keep_record_id ?? ""} onChange={(event) => setChoices((old) => ({ ...old, [conflictKey(conflict)]: { ...old[conflictKey(conflict)], keep_record_id: Number(event.target.value), reason: old[conflictKey(conflict)]?.reason ?? "" } }))}><option value="">Choose</option><option value={conflict.source_record_id}>Source record #{conflict.source_record_id}</option><option value={conflict.canonical_record_id}>Canonical record #{conflict.canonical_record_id}</option></select></label><label>Reason<input value={choices[conflictKey(conflict)]?.reason ?? ""} onChange={(event) => setChoices((old) => ({ ...old, [conflictKey(conflict)]: { ...old[conflictKey(conflict)], keep_record_id: old[conflictKey(conflict)]?.keep_record_id ?? 0, reason: event.target.value } }))} /></label></div>}</li>)}</ul>}
      <button className="auth-submit" disabled={busy || !canExecute} onClick={() => void execute()}>{busy ? "Consolidating…" : "Confirm consolidation"}</button>
    </div>}
    <div className="auth-field"><label htmlFor="consolidation-audit-id">Load audit by ID</label><input id="consolidation-audit-id" inputMode="numeric" value={auditId} onChange={(event) => setAuditId(event.target.value)} /><button className="admin-btn" disabled={busy || !Number(auditId)} onClick={() => void loadAudit()}>Load audit</button></div>
    {result && <pre className="identity-audit-result">{result}</pre>}
  </section>;
}

function conflictKey(conflict: PersonConsolidationConflict) { return `${conflict.type}:${conflict.container_id}:${conflict.source_record_id}:${conflict.canonical_record_id}`; }
