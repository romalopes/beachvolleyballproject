import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Coach } from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
import ClaimInvitationPanel from "../components/people/ClaimInvitationPanel";
import CoachingRelationships from "../components/people/CoachingRelationships";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import {
  archiveCoach,
  canManageProfiles,
  isArchived,
  restoreCoach,
} from "../utils/people";

/**
 * Coach detail: the identity behind the profile plus the coaching attributes.
 *
 * Unlike players, coaches have no training history here — attendance belongs to
 * the participant rows, and a CoachProfile is never a participant. What matters
 * on this page is who the person is, what they coach, and the profile state
 * (account, visibility, archived).
 */
export default function CoachDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Coach not found." : null,
  );
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .coach(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setCoach(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load coach.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, numericId]);

  /** Archive/restore are the same PATCH the edit form uses. */
  const handleArchive = async () => {
    if (!coach) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await archiveCoach(coach.id);
      setCoach({ ...coach, status: updated.status });
      setConfirmingArchive(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!coach) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await restoreCoach(coach.id);
      setCoach({ ...coach, status: updated.status });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !coach)
    return (
      <EmptyState title="Coach not found" description={error ?? undefined} />
    );

  // Mirrors the API's `subject_owner?` for a coach profile: an admin, or the
  // coach who recorded it. Computed after the loading guards so `coach` is known.
  const invitationBlockedReason = !user
    ? "Sign in to invite this coach to claim their profile."
    : !user.roles.includes("admin") && !user.roles.includes("curator") &&
        !(user.roles.includes("coach") && coach.created_by?.id === user.id)
      ? "Only an administrator or the coach who recorded this profile can invite a coach to claim it."
      : null;
  const coachName = coach.full_name ?? coach.person?.first_name ?? coach.display_name ?? `Coach profile #${coach.id}`;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/coaches")}>
          <ArrowLeft size={16} />
          Back to Coaches
        </button>
        <span className="section-label">Coach</span>
        <h1>{coachName}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag>
            {coach.account_status === "connected"
              ? "Account connected"
              : "Profile only"}
          </Tag>
          {coach.coaching_level && <Tag>{coach.coaching_level}</Tag>}
          {coach.visibility === "private" && <Tag>Private</Tag>}
          {isArchived(coach) && <Tag>Archived</Tag>}
        </div>
        {canEdit && (
          <div className="admin-actions-bar">
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-btn admin-btn-add"
                onClick={() => navigate(`/coaches/${coach.id}/edit`)}
              >
                <Pencil size={14} />
                Edit
              </button>
              {isArchived(coach) ? (
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
          </div>
        )}
      </div>

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={coachName}
          title={`Archive “${coachName}”?`}
          warning="The coach leaves the catalogue. Their profile and past trainings are kept, and this can be undone."
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

      <section className="detail-section">
        <h2>Account link</h2>
        <p className="related-item-meta">{coach.account_status === "connected" ? "This profile is linked to an account." : "This profile has no linked account. Create an invitation to let its owner claim it."}</p>
        {coach.account_status !== "connected" && <ClaimInvitationPanel
          key={`${coach.id}:${coach.status}`}
          claimableType="CoachProfile"
          claimableId={coach.id}
          blockedReason={invitationBlockedReason}
          ineligibleReason={isArchived(coach) ? "Restore this profile before creating claim invitations." : null}
          inviteeEmail={null}
        />}
      </section>

      {coach.person?.organisation_memberships?.length ? (
        <section className="detail-section">
          <h2>Organisation memberships</h2>
          <ul className="people-list">
            {coach.person.organisation_memberships.map((m) => (
              <li key={m.id} className="people-row">
                <div className="people-identity">
                  <span className="people-name">
                    {m.organisation?.name ??
                      `Organisation #${m.organisation_id}`}
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
        side="coach"
        profileId={coach.coach_profile_id!}
        canManage={
          canEdit &&
          (Boolean(user?.roles.includes("admin")) ||
            Boolean(
              user?.coach_profile_ids?.includes(coach.coach_profile_id!) ||
              user?.coach_profile_id === coach.coach_profile_id,
            ))
        }
        isAdmin={Boolean(user?.roles.includes("admin"))}
      />

      <section className="detail-section assessment-section">
        <h2>Recorded assessments</h2>
        <p className="related-item-meta">
          {coach.assessments_recorded_count ?? 0} published assessment
          {(coach.assessments_recorded_count ?? 0) === 1 ? "" : "s"} attributed
          to this coach.
        </p>
        <AssessmentList
          assessments={coach.recent_assessments}
          emptyTitle="No assessments recorded"
          emptyDescription="Ratings attributed to this coach will appear here."
          showHistory={false}
        />
      </section>

      <section className="detail-section">
        <h2>Coaching details</h2>
        <p>
          {coach.coaching_level ?? "No coaching level yet"}
          <br />
          {coach.qualifications ?? "No qualifications yet"}
        </p>
        <p className="related-item-meta">
          Visibility: {coach.visibility === "private" ? "Private" : "Shared"}
        </p>
      </section>
    </div>
  );
}
