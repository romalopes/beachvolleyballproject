import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar, AlertCircle, X } from "lucide-react";
import {
  api,
  type AssessmentSession,
  type AssessmentDefinition,
  type Coach,
  type AssessmentSessionInput,
  type Group as GroupRecord,
  type PaginationMeta,
} from "../api";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Tag from "../components/Tag";
import Pagination from "../components/settings/Pagination";

/** Page size for assessment sessions list. */
const PER_PAGE = 20;

export default function AssessmentSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  // Load-once page: `loading` is derived from whether the first load finished,
  // rather than synced by the effect (which would cascade a render, see
  // AdminUsers.tsx).
  const [loaded, setLoaded] = useState(false);
  const loading = !loaded;
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AssessmentSessionInput>({
    name: "",
    assessment_definition_id: 0,
    coach_profile_id: 0,
    scheduled_on: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.assessmentSessions({ page, per_page: PER_PAGE }),
      api.assessmentDefinitions("active"),
      api.coaches(),
      // A group is optional and only seeds the roster, so a failure here must
      // not stop the wizard from opening: it falls back to no group.
      api.groups({ include_private: true }).catch(() => null),
    ])
      .then(([sessionsRes, definitionsRes, coachesRes, groupsRes]) => {
        if (cancelled) return;
        setSessions(sessionsRes.assessment_sessions || []);
        if (sessionsRes.meta) setMeta(sessionsRes.meta);
        setDefinitions(definitionsRes.data || []);
        const coachList = Array.isArray(coachesRes) ? coachesRes : coachesRes.data || [];
        setCoaches(coachList);
        setGroups(groupsRes?.data || []);

        if (definitionsRes.data?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            assessment_definition_id: definitionsRes.data[0].id,
          }));
        }
        if (coachList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            coach_profile_id: coachList[0].id,
          }));
        }
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load assessment sessions.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const handleStartCreate = () => {
    setIsCreating(true);
    setWizardStep(1);
    setCreateError(null);
    setFormData((prev) => ({ ...prev, group_id: null }));
  };

  const handleGoToStep2 = () => {
    setCreateError(null);
    if (!formData.assessment_definition_id) {
      setCreateError("Select an active assessment rubric first.");
      return;
    }
    if (!formData.coach_profile_id) {
      setCreateError("Select a coach of record first.");
      return;
    }
    setWizardStep(2);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formData.name.trim()) {
      setCreateError("Session name is required.");
      return;
    }
    if (!formData.assessment_definition_id) {
      setCreateError("An active assessment definition must be selected.");
      return;
    }
    if (!formData.coach_profile_id) {
      setCreateError("A coach of record must be selected.");
      return;
    }
    if (!formData.scheduled_on) {
      setCreateError("Scheduled date is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createAssessmentSession(formData);
      setIsCreating(false);
      navigate(`/assessment-sessions/${res.assessment_session.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create assessment session.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  const includedCount = (session: AssessmentSession) =>
    (session.participants || []).filter((p) => p.inclusion === "included").length;

  const selectedDef = definitions.find((d) => d.id === formData.assessment_definition_id);

  const coachLabel = (coach: Coach) =>
    `${coach.full_name ||
      [coach.person?.first_name, coach.person?.last_name].filter(Boolean).join(" ") ||
      "Coach"} · profile #${coach.id}`;

  return (
    <div className="page assessment-sessions-page">
      <PageHeader
        title="Assessment Sessions"
        description="Rostered player assessments scored against a defined rubric."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={handleStartCreate}
        >
          <Plus size={16} />
          New Session
        </button>
      </PageHeader>

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="loading">Loading assessment sessions...</p>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No assessment sessions yet"
          description="Create a session to roster players and score them against an active rubric."
        />
      ) : (
        <>
          <div className="session-list">
            <div className="session-list-header">
              <span>Session</span>
              <span>Rubric</span>
              <span>Coach</span>
              <span>Scheduled</span>
              <span>Roster</span>
              <span>Status</span>
            </div>
            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/assessment-sessions/${session.id}`}
                className="session-row"
              >
                <span className="session-name">{session.name}</span>
                <span className="session-def">{session.assessment_definition?.name}</span>
                <span className="session-coach">{session.coach_profile?.full_name}</span>
                <span className="session-date">
                  <Calendar size={14} />
                  {formatDate(session.scheduled_on)}
                </span>
                <span className="session-roster-count">{includedCount(session)} players</span>
                <Tag
                  variant={
                    session.status === "published"
                      ? "teal"
                      : session.status === "withdrawn"
                        ? "primary"
                        : "default"
                  }
                >
                  {session.status_label || session.status}
                </Tag>
              </Link>
            ))}
          </div>
          {meta && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.total_pages}
              totalItems={meta.total}
              itemsPerPage={meta.per_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {isCreating && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!submitting) setIsCreating(false);
          }}
        >
          <div
            className="modal-content session-wizard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>New Assessment Session</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsCreating(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="wizard-steps">
                <span className={wizardStep === 1 ? "wizard-step active" : "wizard-step done"}>
                  1. Rubric &amp; coach
                </span>
                <span className={wizardStep === 2 ? "wizard-step active" : "wizard-step"}>
                  2. Session details
                </span>
              </div>
              {createError && (
                <div className="admin-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}
              <form onSubmit={(e) => void handleCreateSubmit(e)}>
                {wizardStep === 1 ? (
                  <div className="wizard-step-body">
                    <div className="admin-field">
                      <label htmlFor="session-definition">Assessment rubric *</label>
                      <select
                        id="session-definition"
                        value={formData.assessment_definition_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assessment_definition_id: Number(e.target.value),
                          })
                        }
                      >
                        {definitions.length === 0 && (
                          <option value={0}>No active rubrics available</option>
                        )}
                        {definitions.map((def) => (
                          <option key={def.id} value={def.id}>
                            {def.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedDef && (
                      <div className="wizard-rubric-preview">
                        <p className="wizard-hint">
                          Categories in &ldquo;{selectedDef.name}&rdquo; (
                          {selectedDef.assessment_categories.length}):
                        </p>
                        <ul>
                          {selectedDef.assessment_categories.map((cat) => (
                            <li key={cat.id}>
                              {cat.label} <span className="wizard-weight">{cat.weight}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="admin-field">
                      <label htmlFor="session-coach">Coach of record *</label>
                      <select
                        id="session-coach"
                        value={formData.coach_profile_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coach_profile_id: Number(e.target.value),
                          })
                        }
                      >
                        {coaches.length === 0 && <option value={0}>No coaches available</option>}
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coachLabel(coach)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="wizard-step-body">
                    <div className="admin-field">
                      <label htmlFor="session-name">Session name *</label>
                      <input
                        id="session-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. September Combine"
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-date">Scheduled date *</label>
                      <input
                        id="session-date"
                        type="date"
                        value={formData.scheduled_on}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduled_on: e.target.value })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-group">Group (optional)</label>
                      <select
                        id="session-group"
                        value={formData.group_id ?? 0}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            group_id: Number(e.target.value) || null,
                          })
                        }
                      >
                        <option value={0}>No group — add players one by one</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ({group.player_count})
                          </option>
                        ))}
                      </select>
                      <p className="field-hint">
                        Picking a group adds its players to the roster when the session
                        is created. Membership is not attendance — you can still remove
                        anyone who did not show up.
                      </p>
                    </div>
                    <div className="admin-field">
                      <label htmlFor="session-notes">Notes</label>
                      <textarea
                        id="session-notes"
                        rows={3}
                        value={formData.notes ?? ""}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional context for this session"
                      />
                    </div>
                    <p className="wizard-hint">
                      You will add the player roster and scores on the next screen.
                    </p>
                  </div>
                )}
                <div className="admin-form-actions">
                  {wizardStep === 2 && (
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setWizardStep(1)}
                      disabled={submitting}
                    >
                      Back
                    </button>
                  )}
                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn-add"
                      onClick={handleGoToStep2}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="admin-btn admin-btn-add"
                      disabled={submitting}
                    >
                      {submitting ? "Creating..." : "Create Session"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
