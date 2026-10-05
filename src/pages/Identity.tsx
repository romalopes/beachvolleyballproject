import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type MembershipConflictResolution, type PersonConsolidationConflict, type PersonIdentity, type PlayerClaim, type PlayerProfileCandidate } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import ClaimInviteList from "../components/people/ClaimInviteList";

type ResolutionChoice = { keep_record_id: number; reason: string };

/** Self-service identity context and the claim workflows supported by the API. */
export default function IdentityPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<PlayerProfileCandidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [claims, setClaims] = useState<PlayerClaim[]>([]);
  const [reviewClaims, setReviewClaims] = useState<PlayerClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(() => {
    const fragmentToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("claim_token");
    return fragmentToken ?? searchParams.get("claim_token") ?? "";
  });
  const [rejectReason, setRejectReason] = useState("");
  const [accountToken, setAccountToken] = useState(() => {
    const fragmentToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("account_claim_token");
    return fragmentToken ?? searchParams.get("account_claim_token") ?? "";
  });

  const isReviewer = Boolean(user?.roles.some((role) => role === "admin" || role === "coach"));
  const isAdmin = Boolean(user?.roles.includes("admin"));

  const reloadClaims = async () => {
    const mine = await api.playerClaims();
    setClaims(mine.filter((claim) => claim.person_id === user?.person_id));
    if (isReviewer) setReviewClaims(await api.playerClaims());
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      api.playerProfileCandidates().catch(() => [] as PlayerProfileCandidate[]),
      api.playerClaims(),
    ]).then(([suggestions, userClaims]) => {
      if (cancelled) return;
      setCandidates(suggestions);
      setClaims(userClaims.filter((claim) => claim.person_id === user.person_id));
      if (isReviewer) setReviewClaims(userClaims);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load identity information.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, user?.person_id, isReviewer]);

  const redeem = async () => {
    if (!token.trim()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api.redeemClaimInvitation(token.trim());
      // Two outcomes, and the difference matters to the reader: an emailed
      // invitation is linked now, anything else is a request a coach approves.
      setNotice(
        result.outcome === "linked"
          ? "Your profile is now linked to your account."
          : result.message,
      );
      setToken("");
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
      const results = await Promise.allSettled(selected.map((id) => api.requestPlayerClaim(id)));
      const requested = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (requested.length) setClaims((old) => [...requested, ...old]);
      setSelected([]);
      if (requested.length) setNotice(`${requested.length} claim request${requested.length === 1 ? "" : "s"} submitted. Matches are suggestions and still need review.`);
      const rejected = results.find((result) => result.status === "rejected");
      if (rejected?.status === "rejected") setError(rejected.reason instanceof Error ? rejected.reason.message : "One or more claim requests could not be submitted.");
    } catch (err) { setError(err instanceof Error ? err.message : "Claim requests could not be submitted."); }
    finally { setBusy(false); }
  };

  const actOnClaim = async (claim: PlayerClaim, action: "approve" | "reject" | "cancel") => {
    setBusy(true); setError(null); setNotice(null);
    try {
      if (action === "approve") await api.approvePlayerClaim(claim.id);
      if (action === "reject") await api.rejectPlayerClaim(claim.id, rejectReason.trim());
      if (action === "cancel") await api.cancelPlayerClaim(claim.id);
      await reloadClaims();
      const pastTense = { approve: "approved", reject: "rejected", cancel: "cancelled" }[action];
      setNotice(`Claim ${claim.id} ${pastTense}.`);
    } catch (err) { setError(err instanceof Error ? err.message : `Could not ${action} claim.`); }
    finally { setBusy(false); }
  };

  if (!user) return <div className="page"><EmptyState title="Sign in to view your identity" description="Sign in to review your identity context or redeem a player claim invitation." /><Link className="auth-submit" to="/login" state={{ from: `${location.pathname}${location.search}${location.hash}` }}>Sign in</Link></div>;
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

    <section className="detail-section"><h2>Redeem a claim invitation</h2><p>Invitation links connect a profile to your account. An invitation the club emailed you is linked straight away; any other link is sent to a coach or administrator to review.</p>
      <label className="auth-field">Invitation token<input aria-label="Invitation token" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" /></label>
      <button className="auth-submit" disabled={busy || !token.trim() || !user.person_id} onClick={() => void redeem()}>{busy ? "Submitting…" : "Submit claim request"}</button>
      {!user.person_id && <p>A linked Person is required before redeeming an invitation.</p>}
    </section>

    <section className="detail-section"><h2>Suggested player profiles</h2><p>These are possible matches based on your account details. A suggestion does not confirm that a profile is yours.</p>
      {candidates.length ? <ul>{candidates.map((candidate) => <li key={candidate.player_profile_id}>
        <label><input type="checkbox" checked={selected.includes(candidate.player_profile_id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, candidate.player_profile_id] : ids.filter((id) => id !== candidate.player_profile_id))} /> {candidate.display_name} · {candidate.match_type.replaceAll("_", " ")} · Suggested match</label>
      </li>)}</ul> : <p>No profile suggestions are available.</p>}
      <button className="auth-submit" disabled={busy || selected.length === 0} onClick={() => void submitClaims()}>Request selected claims ({selected.length})</button>
    </section>

    <section className="detail-section"><h2>My claim requests</h2>
      {claims.length ? <ul>{claims.map((claim) => <li key={claim.id}>Claim #{claim.id} · Player profile #{claim.player_profile_id} · {claim.status}{claim.status === "pending" && <button className="admin-btn" disabled={busy} onClick={() => void actOnClaim(claim, "cancel")}>Cancel request</button>}</li>)}</ul> : <p>You have no claim requests.</p>}
    </section>

    {isReviewer && <section className="detail-section"><h2>Invitations you can issue</h2><p>These are the player profiles you recorded that nobody has claimed yet. Create an invitation and share the one-time link — or the address-restricted variant — with the player.</p><ClaimInviteList /></section>}

    {isReviewer && <ClaimReview claims={reviewClaims.filter((claim) => claim.person_id !== user.person_id)} busy={busy} reason={rejectReason} setReason={setRejectReason} act={actOnClaim} />}
    {isAdmin && <PersonConsolidation />}
  </div>;
}

function ClaimReview({ claims, busy, reason, setReason, act }: { claims: PlayerClaim[]; busy: boolean; reason: string; setReason: (value: string) => void; act: (claim: PlayerClaim, action: "approve" | "reject" | "cancel") => Promise<void> }) {
  const pending = claims.filter((claim) => claim.status === "pending");
  return <section className="detail-section"><h2>Claims to review</h2>
    {pending.length ? <><label className="auth-field">Reason when rejecting<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><ul>{pending.map((claim) => <li key={claim.id}>Claim #{claim.id} · {claim.player_name || `Player profile #${claim.player_profile_id}`} · Person #{claim.person_id} <button className="admin-btn" disabled={busy} onClick={() => void act(claim, "approve")}>Approve</button> <button className="admin-btn" disabled={busy || !reason.trim()} onClick={() => void act(claim, "reject")}>Reject</button></li>)}</ul></> : <p>No pending claims to review.</p>}
  </section>;
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
