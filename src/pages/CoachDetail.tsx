import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Coach } from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
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
    return <EmptyState title="Coach not found" description={error ?? undefined} />;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/coaches")}>
          <ArrowLeft size={16} />
          Back to Coaches
        </button>
        <span className="section-label">Coach</span>
        <h1>{coach.full_name ?? coach.person.first_name}</h1>
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
          entityName={coach.full_name ?? coach.person.first_name}
          title={`Archive “${coach.full_name ?? coach.person.first_name}”?`}
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
        <h2>Identity</h2>
        <p>
          {coach.person.first_name} {coach.person.last_name ?? ""}
          <br />
          {coach.person.email ?? "No email"} · {coach.person.phone ?? "No phone"}
        </p>
        <p className="related-item-meta">
          Recorded as{" "}
          {coach.person.creation_source === "coach_created"
            ? "a profile entered by a coach"
            : coach.person.creation_source}
          {coach.person.date_of_birth
            ? ` · born ${coach.person.date_of_birth}`
            : ""}
          {coach.created_by ? ` · recorded by ${coach.created_by.name}` : ""}
        </p>
      </section>

      <section className="detail-section assessment-section">
        <h2>Recorded assessments</h2>
        <p className="related-item-meta">
          {coach.assessments_recorded_count ?? 0} published assessment{(coach.assessments_recorded_count ?? 0) === 1 ? "" : "s"} attributed to this coach.
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

