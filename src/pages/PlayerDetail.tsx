import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Player } from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
import ClaimInvitationPanel from "../components/people/ClaimInvitationPanel";
import CoachingRelationships from "../components/people/CoachingRelationships";
import ProfileMergePanel from "../components/identity/ProfileMergePanel";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import {
  archivePlayer,
  canManageProfiles,
  deletePlayerProfile,
  isArchived,
  restorePlayer,
} from "../utils/people";
import { formatTrainingDateRange, participantStatusLabel } from "../utils/training";

/**
 * Player detail: the identity behind the profile, plus read-only history.
 *
 * Training history comes from the participant rows, so it shows the same status
 * the coach set on the session (invited → confirmed → attended/absent) — one
 * place where attendance is recorded, one place where it is read.
 *
 * Assessments are listed read-only: they are now authored inside assessment
 * sessions (assessment plan §8), so this page deliberately offers no
 * assessment-creation form. That keeps "who rated this player, and on what
 * rubric" authored in exactly one place.
 */
export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const canMerge = Boolean(user?.roles.some((role) => role === "admin" || role === "curator"));
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Player not found." : null,
  );
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .player(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setPlayer(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load player.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, numericId]);

  /** Archive/restore are the same PATCH the edit form uses. */
  const handleArchive = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await archivePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
      setConfirmingArchive(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await restorePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      await deletePlayerProfile(player.id);
      navigate("/players");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !player)
    return <EmptyState title="Player not found" description={error ?? undefined} />;

  const playerName = player.full_name?.trim() || player.person?.first_name || player.display_name || "Unnamed player";

  // Mirrors the API's `profile_owner?` (an admin, or the coach who recorded the
  // profile) so the panel can explain *why* it is unavailable instead of
  // silently rendering nothing.
  const invitationBlockedReason = !user
    ? "Sign in to invite this player to claim their profile."
    : !user.roles.includes("admin") && !user.roles.includes("curator") &&
        !(user.roles.includes("coach") && player.created_by?.id === user.id)
      ? "Only an administrator or the coach who recorded this profile can invite a player to claim it."
      : null;

  const history = [...(player.training_session_participants ?? [])].sort(
    (a, b) =>
      (b.training_session?.starts_at ?? "").localeCompare(
        a.training_session?.starts_at ?? "",
      ),
  );

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/players")}>
          <ArrowLeft size={16} />
          Back to Players
        </button>
        <span className="section-label">Player</span>
        <h1>{playerName}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag>
            {player.account_status === "connected"
              ? "Account connected"
              : "Profile only"}
          </Tag>
          {player.preferred_position && <Tag>{player.preferred_position}</Tag>}
          {player.level && <Tag>{player.level}</Tag>}
          <Tag>
            {player.training_session_count ?? history.length} training
            {(player.training_session_count ?? history.length) === 1 ? "" : "s"}
          </Tag>
          {player.visibility === "private" && <Tag>Private</Tag>}
          {isArchived(player) && <Tag>Archived</Tag>}
        </div>
        {canEdit && (
          <div className="admin-actions-bar">
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-btn admin-btn-add"
                onClick={() => navigate(`/players/${player.id}/edit`)}
              >
                <Pencil size={14} />
                Edit
              </button>
              {isArchived(player) ? (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={working}
                  onClick={handleRestore}
                >
                  <ArchiveRestore size={14} />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  disabled={working}
                  onClick={() => setConfirmingArchive(true)}
                >
                  <Archive size={14} />
                  Archive
                </button>
              )}
            </div>
{player.status === "active" && canEdit && (
              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-delete"
                  disabled={working}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <span className="sr-only">Delete</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={playerName}
          title={`Archive “${playerName}”?`}
          warning="The player leaves the catalogue and cannot be added to new trainings. Their training history is kept, and this can be undone."
          confirmLabel="Archive"
          pendingLabel="Archiving..."
          deleting={working}
          error={actionError}
          onCancel={() => {
            setConfirmingArchive(false);
            setActionError(null);
          }}
          onConfirm={handleArchive}
        />
      )}
{confirmingDelete && (
        <DeleteConfirm
          entityName={playerName}
          title={`Delete “${playerName}”?`}
          warning="This permanently removes the player profile. It cannot be undone. The player must not be referenced in any assessment session."
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          deleting={working}
          error={actionError}
          onCancel={() => {
            setConfirmingDelete(false);
            setActionError(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      <section className="detail-section">
        <h2>Account link</h2>
        {player.account_status === "connected" && player.account ? (
          <p className="related-item-meta">
            Linked to account: <a href={`/accounts/${player.account.id}`}><strong>{player.account.full_name}</strong></a>
          </p>
        ) : (
          <p className="related-item-meta">This profile has no linked account. Create an invitation to let its owner claim it.</p>
        )}
        {player.account_status !== "connected" && <ClaimInvitationPanel
          key={`${player.id}:${player.status}`}
          claimableType="PlayerProfile"
          claimableId={player.id}
          blockedReason={invitationBlockedReason}
          ineligibleReason={isArchived(player) ? "Restore this profile before creating claim invitations." : null}
          inviteeEmail={null}
        />}
      </section>

      {canMerge && player.status === "active" && <ProfileMergePanel
        kind="player"
        sourceId={player.id}
        sourceName={playerName}
        onMerged={(canonicalId) => navigate(`/players/${canonicalId}`, { replace: true })}
      />}

      <div className="player-detail-grid">
        {player.person?.organisation_memberships?.length ? (
        <section className="detail-section">
          <h2>Organisation memberships</h2>
          <ul className="people-list">
            {player.person.organisation_memberships.map((m) => (
              <li key={m.id} className="people-row">
                <div className="people-identity">
                  <span className="people-name">
                    {m.organisation?.name ?? `Organisation #${m.organisation_id}`}
                  </span>
                  <span className="people-contact">
                    {m.role} · {m.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CoachingRelationships
        side="player"
        profileId={player.id}
        canManage={
          canEdit &&
          (Boolean(user?.roles.includes("admin")) || Boolean(user?.coach_profile_ids?.length ?? user?.coach_profile_id))
        }
        viewerCoachProfileId={user?.coach_profile_id ?? null}
        viewerCoachProfiles={user?.coach_profiles}
        isAdmin={Boolean(user?.roles.includes("admin"))}
      />

      <section className="detail-section assessment-section">
        <h2>Assessments</h2>
        <p className="related-item-meta">
          Read-only history · {player.assessment_count ?? 0} published assessment{(player.assessment_count ?? 0) === 1 ? "" : "s"}.
          Assessments are recorded inside assessment sessions, not on this page.
        </p>
        <AssessmentList
          assessments={player.assessments}
          emptyTitle="No assessments yet"
          emptyDescription="Published coaching assessments from assessment sessions will appear here."
        />
      </section>

      <section className="detail-section">
        <h2>Training history</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No trainings yet"
            description="This player has not been added to a training session."
          />
        ) : (
          <ul className="people-list">
            {history.map((row) => (
              <li key={row.id} className="people-row">
                <div className="people-identity">
                  {row.training_session ? (
                    <Link
                      to={`/training/${row.training_session.id}`}
                      className="people-name"
                    >
                      {row.training_session.title}
                    </Link>
                  ) : (
                    <span className="people-name">Training session</span>
                  )}
                  <span className="people-contact">
                    {row.training_session
                      ? formatTrainingDateRange(
                          row.training_session.starts_at,
                          row.training_session.ends_at,
                        )
                      : ""}
                  </span>
                </div>
                <Tag>{participantStatusLabel(row.status)}</Tag>
                {row.notes && <span className="people-meta">{row.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
