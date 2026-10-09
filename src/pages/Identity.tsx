import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  api,
  type Account,
  type ClaimInvitation,
  type PlayerClaim,
  type PlayerProfileCandidate,
  type PaginationMeta,
  type Organisation,
  type Group,
  type PaginatedResponse,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import ProfileManagementDashboard from "../components/identity/ProfileManagementDashboard";
import {
  clearClaimInvitationPath,
  rememberClaimInvitationPath,
} from "../auth/invitationReturnPath";

/** Self-service identity context and the claim workflows supported by the API. */
export default function IdentityPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<PlayerProfileCandidate[]>([]);
  const [candidateMeta, setCandidateMeta] = useState<PaginationMeta | null>(
    null,
  );
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [confirmClaims, setConfirmClaims] = useState(false);
  const [receivedInvitations, setReceivedInvitations] = useState<
    ClaimInvitation[]
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileType, setProfileType] = useState<
    "PlayerProfile" | "CoachProfile"
  >("PlayerProfile");
  const [claims, setClaims] = useState<PlayerClaim[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  const loading = Boolean(user) && loadedUserId !== user?.id;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreatePlayerModal, setShowCreatePlayerModal] = useState(false);
  const [createPlayerLoading, setCreatePlayerLoading] = useState(false);
  const [createPlayerError, setCreatePlayerError] = useState<string | null>(
    null,
  );
  const [showCreateCoachModal, setShowCreateCoachModal] = useState(false);
  const [createCoachLoading, setCreateCoachLoading] = useState(false);
  const [createCoachError, setCreateCoachError] = useState<string | null>(null);
  const [showJoinOrgModal, setShowJoinOrgModal] = useState(false);
  const [joinOrgLoading, setJoinOrgLoading] = useState(false);
  const [joinOrgError, setJoinOrgError] = useState<string | null>(null);
  const [joinOrgId, setJoinOrgId] = useState("");
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinGroupLoading, setJoinGroupLoading] = useState(false);
  const [joinGroupError, setJoinGroupError] = useState<string | null>(null);
  const [joinGroupId, setJoinGroupId] = useState("");
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [token, setToken] = useState(() => {
    const fragmentToken = new URLSearchParams(
      location.hash.replace(/^#/, ""),
    ).get("claim_token");
    return fragmentToken ?? searchParams.get("claim_token") ?? "";
  });

  const [account, setAccount] = useState<Account | null>(null);

  const canManageProfiles = Boolean(
    user?.roles.some(
      (role) => role === "admin" || role === "coach" || role === "curator",
    ),
  );
  const userId = user?.id;
  const accountId = user?.account_id;
  const invitationReturnPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (token) rememberClaimInvitationPath(invitationReturnPath);
  }, [token, invitationReturnPath]);

  // fetch organisations and groups for join modals
  useEffect(() => {
    const fetchLists = async () => {
      setOrgsLoading(true);
      setGroupsLoading(true);
      try {
        const orgsResp = await api.organisations(
          "active",
          undefined,
          false,
          false,
        );
        // api returns PaginatedResponse<Organisation>
        const orgsData =
          (orgsResp as PaginatedResponse<Organisation>).data ?? orgsResp;
        setOrganisations(Array.isArray(orgsData) ? orgsData : []);
      } catch (e) {
        console.error("Failed to load organisations", e);
        setOrganisations([]);
      } finally {
        setOrgsLoading(false);
      }
      try {
        const groupsResp = await api.groups({ status: "active", mine: false });
        const groupsData =
          (groupsResp as PaginatedResponse<Group>).data ?? groupsResp;
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } catch (e) {
        console.error("Failed to load groups", e);
        setGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };
    fetchLists();
  }, []);

  const reloadClaims = async () => {
    const mine = await api.playerClaims();
    setClaims(
      mine.filter((claim) => claim.claimant_account_id === user?.account_id),
    );
    setReceivedInvitations(await api.receivedClaimInvitations());
  };

  const handleCreatePlayerSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCreatePlayerError(null);
    setCreatePlayerLoading(true);

    const formData = new FormData(event.currentTarget);
    const displayName = formData.get("display_name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const preferredPosition =
      formData.get("preferred_position")?.toString() ?? "";
    const level = formData.get("level")?.toString() ?? "";

    if (!displayName) {
      setCreatePlayerError("Display name is required");
      setCreatePlayerLoading(false);
      return;
    }

    try {
      await api.createPlayer({
        player_profile: {
          display_name: displayName,
          email: email || null,
          preferred_position: preferredPosition || null,
          level: level || null,
          link_to_account: true,
        },
      });
      setNotice("Player profile created successfully!");
      setShowCreatePlayerModal(false);
      // Reload the page to reflect the new profile
      window.location.reload();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create player profile";
      setCreatePlayerError(message);
    } finally {
      setCreatePlayerLoading(false);
    }
  };

  const handleCloseCreatePlayerModal = () => {
    setShowCreatePlayerModal(false);
    setCreatePlayerError(null);
  };

  const handleCreateCoachSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCreateCoachError(null);
    setCreateCoachLoading(true);

    const formData = new FormData(event.currentTarget);
    const displayName = formData.get("display_name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const coachingLevel = formData.get("coaching_level")?.toString() ?? "";
    const qualifications = formData.get("qualifications")?.toString() ?? "";

    if (!displayName) {
      setCreateCoachError("Display name is required");
      setCreateCoachLoading(false);
      return;
    }

    try {
      await api.createCoach({
        coach_profile: {
          display_name: displayName,
          email: email || null,
          coaching_level: coachingLevel || null,
          qualifications: qualifications || null,
          link_to_account: true,
        },
      });
      setNotice("Coach profile created successfully!");
      setShowCreateCoachModal(false);
      // Reload the page to reflect the new profile
      window.location.reload();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create coach profile";
      setCreateCoachError(message);
    } finally {
      setCreateCoachLoading(false);
    }
  };

  const handleCloseCreateCoachModal = () => {
    setShowCreateCoachModal(false);
    setCreateCoachError(null);
  };

  const handleJoinOrganisation = async () => {
    const orgId = parseInt(joinOrgId, 10);
    if (isNaN(orgId)) {
      setJoinOrgError("Please enter a valid organisation ID");
      return;
    }
    setJoinOrgError(null);
    setJoinOrgLoading(true);
    try {
      await api.joinOrganisation(orgId);
      setNotice("Organisation membership request sent!");
      setShowJoinOrgModal(false);
      setJoinOrgId("");
      // Reload the page to reflect the new organisation membership
      window.location.reload();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to join organisation";
      setJoinOrgError(message);
    } finally {
      setJoinOrgLoading(false);
    }
  };

  const handleCloseJoinOrgModal = () => {
    setShowJoinOrgModal(false);
    setJoinOrgError(null);
    setJoinOrgId("");
  };

  const handleJoinGroup = async () => {
    const groupId = parseInt(joinGroupId, 10);
    if (isNaN(groupId)) {
      setJoinGroupError("Please enter a valid group ID");
      return;
    }
    setJoinGroupError(null);
    setJoinGroupLoading(true);
    try {
      await api.joinGroup(groupId);
      setNotice("Group membership request sent!");
      setShowJoinGroupModal(false);
      setJoinGroupId("");
      // Reload the page to reflect the new group membership
      window.location.reload();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to join group";
      setJoinGroupError(message);
    } finally {
      setJoinGroupLoading(false);
    }
  };

  const handleCloseJoinGroupModal = () => {
    setShowJoinGroupModal(false);
    setJoinGroupError(null);
    setJoinGroupId("");
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([api.playerClaims(), api.receivedClaimInvitations()])
      .then(([userClaims, received]) => {
        if (cancelled) return;
        setClaims(
          userClaims.filter((claim) => claim.claimant_account_id === accountId),
        );
        setReceivedInvitations(received);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load identity information.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadedUserId(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, accountId, loadedUserId]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    api
      .accountDetail(accountId)
      .then((acc) => {
        if (!cancelled) setAccount(acc);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, loadedUserId]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const search = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setCandidateLoading(true);
      setCandidateError(null);
      try {
        const result = await api.searchProfileCandidates({
          type: profileType,
          q: submittedQuery,
          organisationId: organisationId ? Number(organisationId) : undefined,
          page: candidatePage,
          perPage: 20,
        });
        if (!cancelled) {
          setCandidates(result.data);
          setCandidateMeta(result.meta);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setCandidates([]);
          setCandidateMeta(null);
          setCandidateError(
            err instanceof Error ? err.message : "Could not search profiles.",
          );
        }
      } finally {
        if (!cancelled) setCandidateLoading(false);
      }
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [accountId, profileType, submittedQuery, organisationId, candidatePage]);

  const redeem = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
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
      navigate(
        {
          pathname: location.pathname,
          search: next.toString() ? `?${next}` : "",
          hash: "",
        },
        { replace: true },
      );
      await reloadClaims();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invitation could not be redeemed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitClaims = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const results = await Promise.allSettled(
        selected.map((key) => {
          const [type, rawId] = key.split(":");
          return type === "CoachProfile"
            ? api.requestProfileClaim("CoachProfile", Number(rawId))
            : api.requestPlayerClaim(Number(rawId));
        }),
      );
      const requested = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (requested.length) setClaims((old) => [...requested, ...old]);
      setSelected([]);
      setConfirmClaims(false);
      if (requested.length)
        setNotice(
          `${requested.length} claim request${requested.length === 1 ? "" : "s"} submitted. Matches are suggestions and still need review.`,
        );
      const rejected = results.find((result) => result.status === "rejected");
      if (rejected?.status === "rejected")
        setError(
          rejected.reason instanceof Error
            ? rejected.reason.message
            : "One or more claim requests could not be submitted.",
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Claim requests could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  };

  const invitationAction = async (
    invitation: ClaimInvitation,
    action: "accept" | "decline",
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "accept") {
        const result = await api.acceptReceivedClaimInvitation(invitation.id);
        setNotice(
          result.outcome === "linked"
            ? "Invitation accepted. The profile is now linked to your account."
            : result.message,
        );
      } else {
        await api.declineReceivedClaimInvitation(invitation.id);
        setNotice("Invitation declined.");
      }
      await reloadClaims();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not ${action} invitation.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const actOnClaim = async (claim: PlayerClaim) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.cancelPlayerClaim(claim.id);
      await reloadClaims();
      setNotice(`Claim ${claim.id} cancelled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel claim.");
    } finally {
      setBusy(false);
    }
  };

  const leaveOrganisation = async (orgId: number, membershipId: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.endOrganisationMembership(orgId, membershipId);
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not leave organisation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const leaveGroup = async (groupId: number, membershipId: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.rejectGroupMembership(groupId, membershipId);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave group.");
    } finally {
      setBusy(false);
    }
  };

  if (!user)
    return (
      <div className="page">
        <EmptyState
          title="Sign in to view your identity"
          description="Sign in or create an account to redeem this invitation. The invitation link will be restored after email verification."
        />
        <Link
          className="auth-submit"
          to="/login"
          state={{ from: invitationReturnPath }}
        >
          Sign in
        </Link>
      </div>
    );
  if (loading) return <div className="loading">Loading identity…</div>;

  return (
    <div className="page identity-page">
      <header className="page-header">
        <h1>Identity</h1>
        <p>Your account, profiles, memberships, and profile claim requests.</p>
      </header>
      {error && (
        <div className="auth-flash auth-flash-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="auth-flash auth-flash-notice" role="status">
          {notice}
        </div>
      )}

      <div className="identity-grid">
        <section
          className="detail-section"
          aria-labelledby="account-context-heading"
        >
          <h2 id="account-context-heading">Account</h2>
          <dl className="identity-context">
            <dt>Account</dt>
            <dd>
              {account ? (
                <Link className="identity-link" to={`/accounts/${account.id}`}>
                  {account.full_name ?? `Account #${account.id}`}
                </Link>
              ) : user.account_id ? (
                <Link
                  className="identity-link"
                  to={`/accounts/${user.account_id}`}
                >
                  View account #{user.account_id}
                </Link>
              ) : (
                "No linked account"
              )}
            </dd>
          </dl>
        </section>
        <section className="detail-section">
          <h2>Player profiles</h2>
          {user.player_profiles?.length ? (
            <ul className="identity-link-list">
              {user.player_profiles.map((profile) => (
                <li key={profile.id}>
                  <Link className="identity-link" to={`/players/${profile.id}`}>
                    {profile.display_name || `Player profile #${profile.id}`}
                  </Link>{" "}
                  · {profile.status}
                  {profile.level ? ` · ${profile.level}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p>No player profiles are linked to this account.</p>
              <button
                className="auth-submit"
                type="button"
                onClick={() => setShowCreatePlayerModal(true)}
              >
                Create Player Profile
              </button>
            </>
          )}
        </section>
        <section className="detail-section">
          <h2>Coach profiles</h2>
          {user.coach_profiles?.length ? (
            <ul className="identity-link-list">
              {user.coach_profiles.map((profile) => (
                <li key={profile.id}>
                  <Link className="identity-link" to={`/coaches/${profile.id}`}>
                    {/* user.coach_profiles is denormalised from GET /me (account's active coach profiles) */}
                    {profile.display_name || `Coach profile #${profile.id}`}
                  </Link>{" "}
                  · {profile.coaching_level || "Level not set"} ·{" "}
                  {profile.status}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p>No coach profiles are linked to this account.</p>
              <button
                className="auth-submit"
                type="button"
                onClick={() => setShowCreateCoachModal(true)}
              >
                Create Coach Profile
              </button>
            </>
          )}
        </section>
        <section className="detail-section">
          <h2>Organisation memberships</h2>
          {user.organisation_memberships?.length ? (
            <ul className="identity-link-list">
              {user.organisation_memberships.map((membership) => (
                <li key={membership.id}>
                  <Link
                    className="identity-link"
                    to={`/organisations/${membership.organisation_id}`}
                  >
                    {membership.organisation?.name ||
                      `Organisation #${membership.organisation_id}`}
                  </Link>{" "}
                  · {membership.role} · {membership.status}
                  {membership.status === "active" && (
                    <button
                      className="admin-btn"
                      onClick={() =>
                        leaveOrganisation(
                          membership.organisation_id,
                          membership.id,
                        )
                      }
                    >
                      Leave
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No organisation memberships.</p>
          )}
          <button
            className="auth-submit"
            type="button"
            onClick={() => setShowJoinOrgModal(true)}
          >
            Join Organisation
          </button>
        </section>
        <section className="detail-section">
          <h2>Group memberships</h2>
          {user.group_memberships?.length ? (
            <ul className="identity-link-list">
              {user.group_memberships.map((membership) => (
                <li key={membership.id}>
                  <Link
                    className="identity-link"
                    to={`/groups/${membership.group_id}`}
                  >
                    {membership.group.name}
                  </Link>{" "}
                  · {membership.role} · {membership.status} ·{" "}
                  {membership.group.organisation?.name}
                  {membership.status === "active" &&
                    membership.role !== "owner" && (
                      <button
                        className="admin-btn"
                        onClick={() =>
                          leaveGroup(membership.group_id, membership.id)
                        }
                      >
                        Leave
                      </button>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No group memberships.</p>
          )}
          <button
            className="auth-submit"
            type="button"
            onClick={() => setShowJoinGroupModal(true)}
          >
            Join Group
          </button>
        </section>

        <section className="detail-section">
          <h2>Redeem a claim invitation</h2>
          <p>
            Redeeming an active invitation accepts it and links the profile to
            your account. An invitation addressed to an email also requires that
            email to be verified.
          </p>
          <label className="auth-field">
            Invitation token
            <input
              aria-label="Invitation token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            className="auth-submit"
            disabled={busy || !token.trim()}
            onClick={() => void redeem()}
          >
            {busy ? "Submitting…" : "Redeem invitation"}
          </button>
        </section>

        <section className="detail-section">
          <h2>Claim profiles</h2>
          {!accountId ? (
            <p role="note">
              Your account is not yet linked to a profile, so profile
              suggestions are not available yet. Ask a coach or administrator to
              create an invite link from your player or coach profile, then
              redeem it above while signed in. If the link is tied to your
              recorded email, verify that email first.
            </p>
          ) : (
            <>
              <p>
                Search active, unlinked profiles by name. A match is only a
                suggestion; your request will be reviewed before a profile is
                linked.
              </p>
              <div role="tablist" aria-label="Profile type">
                <button
                  role="tab"
                  aria-selected={profileType === "PlayerProfile"}
                  onClick={() => {
                    setProfileType("PlayerProfile");
                    setSelected([]);
                    setCandidatePage(1);
                  }}
                >
                  Players
                </button>
                <button
                  role="tab"
                  aria-selected={profileType === "CoachProfile"}
                  onClick={() => {
                    setProfileType("CoachProfile");
                    setSelected([]);
                    setCandidatePage(1);
                  }}
                >
                  Coaches
                </button>
              </div>
              <div className="identity-candidate-search">
                <label className="auth-field">
                  Search by name
                  <input
                    aria-label="Search profiles by name"
                    value={candidateQuery}
                    onChange={(event) => setCandidateQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setSubmittedQuery(candidateQuery);
                        setCandidatePage(1);
                      }
                    }}
                  />
                </label>
                {(user.organisation_memberships ?? []).some(
                  (membership) => membership.status === "active",
                ) && (
                  <label className="auth-field">
                    Organisation
                    <select
                      aria-label="Filter by organisation"
                      value={organisationId}
                      onChange={(event) => {
                        setOrganisationId(event.target.value);
                        setCandidatePage(1);
                      }}
                    >
                      <option value="">All eligible organisations</option>
                      {(user.organisation_memberships ?? [])
                        .filter((membership) => membership.status === "active")
                        .map((membership) => (
                          <option
                            key={membership.organisation_id}
                            value={membership.organisation_id}
                          >
                            {membership.organisation?.name ||
                              `Organisation #${membership.organisation_id}`}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button
                  className="admin-btn"
                  onClick={() => {
                    setSubmittedQuery(candidateQuery);
                    setCandidatePage(1);
                  }}
                >
                  Search
                </button>
              </div>
              {candidateLoading ? (
                <p role="status">Searching eligible profiles…</p>
              ) : candidateError ? (
                <p role="alert">{candidateError}</p>
              ) : candidates.length ? (
                <ul>
                  {candidates.map((candidate) => {
                    const type = candidate.claimable_type ?? "PlayerProfile";
                    const id =
                      candidate.claimable_id ??
                      candidate.player_profile_id ??
                      candidate.coach_profile_id ??
                      candidate.id;
                    const key = `${type}:${id}`;
                    const existingClaim = claims.find(
                      (claim) =>
                        claim.claimable_type === type &&
                        claim.claimable_id === id &&
                        ["pending", "approved"].includes(claim.status),
                    );
                    return (
                      <li key={key}>
                        {existingClaim ? (
                          <span>
                            {candidate.display_name} · Claim{" "}
                            {existingClaim.status}
                          </span>
                        ) : (
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.includes(key)}
                              onChange={(event) =>
                                setSelected((ids) =>
                                  event.target.checked
                                    ? [...ids, key]
                                    : ids.filter((id) => id !== key),
                                )
                              }
                            />{" "}
                            {candidate.display_name} ·{" "}
                            {candidate.match_type.replaceAll("_", " ")} ·
                            Suggested match
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>
                  {submittedQuery.length > 0 && submittedQuery.length < 3
                    ? "Enter at least 3 characters to search."
                    : "No eligible profiles found. Try another name or ask a coach or administrator for an invite link."}
                </p>
              )}
              {candidateMeta && candidateMeta.total_pages > 1 && (
                <nav aria-label="Profile search pages">
                  <button
                    className="admin-btn"
                    disabled={candidatePage <= 1 || candidateLoading}
                    onClick={() => setCandidatePage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {candidateMeta.page} of {candidateMeta.total_pages}
                  </span>
                  <button
                    className="admin-btn"
                    disabled={
                      candidatePage >= candidateMeta.total_pages ||
                      candidateLoading
                    }
                    onClick={() => setCandidatePage((page) => page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
              <button
                className="auth-submit"
                disabled={busy || selected.length === 0}
                onClick={() => setConfirmClaims(true)}
              >
                Review selected claims ({selected.length})
              </button>
              {confirmClaims && (
                <div role="group" aria-label="Confirm claim requests">
                  <p>
                    Submit {selected.length} claim request
                    {selected.length === 1 ? "" : "s"}? A coach or administrator
                    must approve each request before a profile is linked.
                  </p>
                  <button
                    className="auth-submit"
                    disabled={busy}
                    onClick={() => void submitClaims()}
                  >
                    Submit claim request{selected.length === 1 ? "" : "s"}
                  </button>
                  <button
                    className="admin-btn"
                    disabled={busy}
                    onClick={() => setConfirmClaims(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="detail-section">
          <h2>My claim requests</h2>
          {claims.length ? (
            <ul>
              {claims.map((claim) => (
                <li key={claim.id}>
                  Claim #{claim.id} ·{" "}
                  {claim.claimable_type?.replace("Profile", " profile ") ||
                    "Profile"}{" "}
                  #{claim.claimable_id ?? claim.player_profile_id ?? "—"} ·{" "}
                  {claim.status}
                  {claim.status === "pending" && (
                    <button
                      className="admin-btn"
                      disabled={busy}
                      onClick={() => void actOnClaim(claim)}
                    >
                      Cancel request
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>You have no claim requests.</p>
          )}
        </section>

        <section className="detail-section">
          <h2>Invitations received</h2>
          {receivedInvitations.length ? (
            <ul>
              {receivedInvitations.map((invitation) => {
                const name =
                  invitation.claimable_name ??
                  `${invitation.claimable_type.replace("Profile", " profile ")} #${invitation.claimable_id}`;
                const href =
                  invitation.claimable_type === "PlayerProfile"
                    ? `/players/${invitation.claimable_id}`
                    : invitation.claimable_type === "CoachProfile"
                      ? `/coaches/${invitation.claimable_id}`
                      : null;
                return (
                  <li key={invitation.id}>
                    {href ? (
                      <a href={href}>
                        <strong>{name}</strong>
                      </a>
                    ) : (
                      <span>
                        <strong>{name}</strong>
                      </span>
                    )}
                    · {invitation.status}
                    {invitation.status === "active" && (
                      <>
                        <button
                          className="admin-btn"
                          disabled={busy}
                          onClick={() =>
                            void invitationAction(invitation, "accept")
                          }
                        >
                          Accept
                        </button>
                        <button
                          className="admin-btn"
                          disabled={busy}
                          onClick={() =>
                            void invitationAction(invitation, "decline")
                          }
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No invitations have been sent to your verified account email.</p>
          )}
        </section>

        <section className="detail-section">
          <h2>Claim and invitation history</h2>
          {claims.some((claim) => claim.status !== "pending") ||
          receivedInvitations.some(
            (invitation) => invitation.status !== "active",
          ) ? (
            <ul>
              {claims
                .filter((claim) => claim.status !== "pending")
                .map((claim) => (
                  <li key={`claim-${claim.id}`}>
                    Claim #{claim.id} ·{" "}
                    {claim.claimable_type?.replace("Profile", " profile ") ||
                      "Profile"}{" "}
                    · {claim.status}
                    {claim.reviewed_at
                      ? ` · ${new Date(claim.reviewed_at).toLocaleDateString()}`
                      : ""}
                  </li>
                ))}
              {receivedInvitations
                .filter((invitation) => invitation.status !== "active")
                .map((invitation) => (
                  <li key={`invitation-${invitation.id}`}>
                    Invitation #{invitation.id} ·{" "}
                    {invitation.claimable_type.replace("Profile", " profile ")}{" "}
                    · {invitation.status}
                  </li>
                ))}
            </ul>
          ) : (
            <p>No claim or invitation history yet.</p>
          )}
        </section>
      </div>
      {showCreatePlayerModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseCreatePlayerModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-player-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="create-player-title">Create Player Profile</h2>
              <button
                className="modal-close"
                onClick={handleCloseCreatePlayerModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form onSubmit={handleCreatePlayerSubmit} noValidate>
                {createPlayerError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {createPlayerError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="display_name">
                    Display name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="display_name"
                    name="display_name"
                    type="text"
                    required
                    autoComplete="off"
                    disabled={createPlayerLoading}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="player_email">Email</label>
                  <input
                    id="player_email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    disabled={createPlayerLoading}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="preferred_position">Preferred position</label>
                  <select
                    id="preferred_position"
                    name="preferred_position"
                    disabled={createPlayerLoading}
                  >
                    <option value="">Select position</option>
                    <option value="setter">Setter</option>
                    <option value="blocker">Blocker</option>
                    <option value="defender">Defender</option>
                    <option value="universal">Universal</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label htmlFor="level">Level</label>
                  <select
                    id="level"
                    name="level"
                    disabled={createPlayerLoading}
                  >
                    <option value="">Select level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
                <div
                  className="modal-actions"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "flex-end",
                    marginTop: "1.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseCreatePlayerModal}
                    disabled={createPlayerLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={createPlayerLoading}
                  >
                    {createPlayerLoading
                      ? "Creating…"
                      : "Create Player Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showCreateCoachModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseCreateCoachModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-coach-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="create-coach-title">Create Coach Profile</h2>
              <button
                className="modal-close"
                onClick={handleCloseCreateCoachModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form onSubmit={handleCreateCoachSubmit} noValidate>
                {createCoachError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {createCoachError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="coach_display_name">
                    Display name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="coach_display_name"
                    name="display_name"
                    type="text"
                    required
                    autoComplete="off"
                    disabled={createCoachLoading}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="coach_email">Email</label>
                  <input
                    id="coach_email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    disabled={createCoachLoading}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="coaching_level">Coaching level</label>
                  <select
                    id="coaching_level"
                    name="coaching_level"
                    disabled={createCoachLoading}
                  >
                    <option value="">Select level</option>
                    <option value="assistant">Assistant</option>
                    <option value="level1">Level 1</option>
                    <option value="level2">Level 2</option>
                    <option value="level3">Level 3</option>
                    <option value="level4">Level 4</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label htmlFor="qualifications">Qualifications</label>
                  <textarea
                    id="qualifications"
                    name="qualifications"
                    disabled={createCoachLoading}
                    rows={3}
                  />
                </div>
                <div
                  className="modal-actions"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "flex-end",
                    marginTop: "1.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseCreateCoachModal}
                    disabled={createCoachLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={createCoachLoading}
                  >
                    {createCoachLoading ? "Creating…" : "Create Coach Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showJoinOrgModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseJoinOrgModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-org-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-org-title">Join Organisation</h2>
              <button
                className="modal-close"
                onClick={handleCloseJoinOrgModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinOrganisation();
                }}
              >
                {joinOrgError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {joinOrgError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="org_id">
                    Organisation <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="org_id"
                    name="org_id"
                    required
                    value={joinOrgId}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                    disabled={joinOrgLoading || orgsLoading}
                  >
                    <option value="">Select organisation</option>
                    {orgsLoading ? (
                      <option disabled>Loading organisations…</option>
                    ) : organisations.length === 0 ? (
                      <option disabled>No organisations available</option>
                    ) : (
                      organisations.map((org) => (
                        <option key={org.id} value={String(org.id)}>
                          {org.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div
                  className="modal-actions"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "flex-end",
                    marginTop: "1.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseJoinOrgModal}
                    disabled={joinOrgLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={joinOrgLoading || !joinOrgId}
                  >
                    {joinOrgLoading ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showJoinGroupModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseJoinGroupModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-group-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="join-group-title">Join Group</h2>
              <button
                className="modal-close"
                onClick={handleCloseJoinGroupModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinGroup();
                }}
              >
                {joinGroupError && (
                  <div className="auth-flash auth-flash-error" role="alert">
                    {joinGroupError}
                  </div>
                )}
                <div className="auth-field">
                  <label htmlFor="group_id">
                    Group <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="group_id"
                    name="group_id"
                    required
                    value={joinGroupId}
                    onChange={(e) => setJoinGroupId(e.target.value)}
                    disabled={joinGroupLoading || groupsLoading}
                  >
                    <option value="">Select group</option>
                    {groupsLoading ? (
                      <option disabled>Loading groups…</option>
                    ) : groups.length === 0 ? (
                      <option disabled>No groups available</option>
                    ) : (
                      groups.map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div
                  className="modal-actions"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "flex-end",
                    marginTop: "1.5rem",
                  }}
                >
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={handleCloseJoinGroupModal}
                    disabled={joinGroupLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={joinGroupLoading || !joinGroupId}
                  >
                    {joinGroupLoading ? "Requesting…" : "Request Membership"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {canManageProfiles && <ProfileManagementDashboard />}
    </div>
  );
}
