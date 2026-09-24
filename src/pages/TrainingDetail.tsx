import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  api,
  type Drill,
  type ParticipantStatus,
  type TrainingSession,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import AssessmentList from "../components/people/AssessmentList";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DrillViewer from "../components/drill/DrillViewer";
import { resolveDrillDefinition } from "../components/drill/definition";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import ParticipantRoster from "../components/training/ParticipantRoster";
import VideoList from "../components/video/VideoList";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Dumbbell,
  MapPin,
  Target,
} from "lucide-react";
import {
  canManageTrainings,
  formatTrainingDateRange,
  isPrivateSession,
  statusLabel,
  visibilityLabel,
} from "../utils/training";

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "Duration not set";
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function DrillSteps({ drill }: { drill: Drill }) {
  const definition = resolveDrillDefinition(drill.definition);
  const steps = definition?.steps ?? [];
  if (steps.length === 0) return null;
  return (
    <ol className="training-drill-steps">
      {steps.map((step, index) => (
        <li key={step.id || index}>
          <strong>Step {index + 1}</strong>
          {step.description ? `: ${step.description}` : ""}
        </li>
      ))}
    </ol>
  );
}

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTrainings(user);
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Training session not found." : null,
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Bumped after video reference changes so the session refetches its videos. */
  const [videosReloadKey, setVideosReloadKey] = useState(0);
  /** Participant whose attendance is being saved. */
  const [savingParticipantId, setSavingParticipantId] = useState<number | null>(
    null,
  );
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .trainingSession(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setSession(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to load training.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, numericId, videosReloadKey]);

  /**
   * Attendance is a participant status, so marking it updates the session.
   * The response is the full session, so the roster (and its summary) is
   * refreshed from the server rather than patched locally.
   */
  const handleStatusChange = async (
    participantId: number,
    status: ParticipantStatus,
  ) => {
    if (!session) return;
    setSavingParticipantId(participantId);
    setRosterError(null);
    try {
      const updated = await api.updateTrainingSession(session.id, {
        training_session_participants_attributes: [{ id: participantId, status }],
      });
      setSession(updated);
    } catch (e) {
      setRosterError(
        e instanceof Error ? e.message : "Failed to update the participant.",
      );
    } finally {
      setSavingParticipantId(null);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteTrainingSession(session.id);
      navigate("/training");
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete training.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !session)
    return (
      <EmptyState
        title="Training session not found"
        description={error ?? undefined}
      />
    );

  const focuses = [...(session.training_focuses ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const drills = [...(session.training_session_drills ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/training")}>
          <ArrowLeft size={16} />
          Back to Training
        </button>
        <span className="section-label">Training Session</span>
        <h1>{session.title}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag variant="primary">{statusLabel(session.status)}</Tag>
          {isPrivateSession(session) && <Tag>Private</Tag>}
          {session.duration_minutes != null && (
            <Tag>
              <Clock
                size={12}
                style={{ marginRight: "0.25rem", verticalAlign: "middle" }}
              />
              {session.duration_minutes} min
            </Tag>
          )}
          {session.location && <Tag>{session.location}</Tag>}
        </div>
      </div>

      {canManage && (
        <div className="admin-actions-bar">
          <div className="admin-table-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate(`/training/${session.id}/edit`)}
            >
              Edit
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <DeleteConfirm
          entityName={session.title}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}

      <section className="detail-section">
        <h2>Session Details</h2>
        <p>
          <CalendarDays
            size={16}
            style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
          />
          {formatTrainingDateRange(session.starts_at, session.ends_at)}
          {session.location && (
            <>
              <br />
              <MapPin
                size={16}
                style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
              />
              {session.location}
            </>
          )}
        </p>
        <p className="related-item-meta">
          Visibility: {visibilityLabel(session.visibility)}
        </p>
      </section>

      {(session.training_session_participants?.length ?? 0) > 0 ||
      canManage ? (
        <section className="detail-section">
          <h2>Players</h2>
          {canManage && (
            <p className="related-item-meta">
              Mark attendance once the session is over — attended or absent.
            </p>
          )}
          {rosterError && <div className="admin-error">{rosterError}</div>}
          <ParticipantRoster
            participants={session.training_session_participants}
            savingId={savingParticipantId}
            onStatusChange={canManage ? handleStatusChange : undefined}
          />
          {(session.training_session_participants ?? []).some((participant) => (participant.assessments?.length ?? 0) > 0) && (
            <div className="training-session-assessments">
              <h3>Assessments in this session</h3>
              {(session.training_session_participants ?? []).map((participant) => (
                participant.assessments?.length ? (
                  <div key={participant.id}>
                    <h4>{participant.player_name ?? `Player #${participant.player_profile_id}`}</h4>
                    <AssessmentList assessments={participant.assessments} showHistory={false} />
                  </div>
                ) : null
              ))}
            </div>
          )}
        </section>
      ) : null}

      {session.description && (
        <section className="detail-section">
          <h2>Description</h2>
          <p>{session.description}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>Training Focuses</h2>
        {focuses.length === 0 ? (
          <EmptyState
            title="No focuses yet"
            description="Focuses will appear here when added."
          />
        ) : (
          <ol className="training-focus-list">
            {focuses.map((focus, index) => (
              <li key={focus.id} className="training-focus-item">
                <span className="training-focus-title">
                  {index + 1}.{" "}
                  {focus.skill ? (
                    <Link to={`/skills/${focus.skill.slug}`}>
                      {focus.skill.title}
                    </Link>
                  ) : (
                    focus.custom_focus
                  )}
                </span>
                {focus.skill?.category && (
                  <span className="related-item-meta">
                    {" "}
                    · {focus.skill.category.name}
                  </span>
                )}
                {focus.description && <p>{focus.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="detail-section">
        <h2>Drills</h2>
        {drills.length === 0 ? (
          <EmptyState
            title="No drills yet"
            description="Drills will appear here when added."
          />
        ) : (
          <div className="training-drill-list">
            {drills.map((row, index) => {
              const drill = row.drill;
              if (!drill) return null;
              const definition = resolveDrillDefinition(drill.definition);
              return (
                <article key={row.id} className="training-drill">
                  <h3>
                    {index + 1}.{" "}
                    <Link to={`/drills/${drill.slug}`}>{drill.title}</Link>
                  </h3>
                  <p className="training-drill-meta">
                    <Clock
                      size={14}
                      style={{
                        marginRight: "0.25rem",
                        verticalAlign: "middle",
                      }}
                    />
                    {formatDuration(row.duration_minutes)}
                  </p>
                  {row.notes && (
                    <p className="training-drill-notes">
                      <strong>Notes:</strong> {row.notes}
                    </p>
                  )}
                  {drill.setup_instructions && (
                    <p>{drill.setup_instructions}</p>
                  )}
                  {definition ? (
                    <DrillViewer definition={definition} />
                  ) : (
                    <EmptyState title="No visualisation yet" />
                  )}
                  <h4>Steps</h4>
                  <DrillSteps drill={drill} />
                  {drill.skills && drill.skills.length > 0 && (
                    <div className="tags">
                      {drill.skills.map((skill) => (
                        <span key={skill.id} className="tag">
                          <Target
                            size={12}
                            style={{
                              marginRight: "0.25rem",
                              verticalAlign: "middle",
                            }}
                          />
                          {skill.title}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="related-item-meta">
                    <Dumbbell
                      size={14}
                      style={{
                        marginRight: "0.25rem",
                        verticalAlign: "middle",
                      }}
                    />
                    <Link to={`/drills/${drill.slug}`}>Open full drill</Link>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Videos</h2>
        <VideoList
          references={session.video_references}
          target="training_sessions"
          targetId={session.id}
          canManage={canManage}
          onChanged={() => setVideosReloadKey((key) => key + 1)}
        />
      </section>
    </div>
  );
}
