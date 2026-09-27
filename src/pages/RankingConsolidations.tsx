import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, AlertCircle, X } from "lucide-react";
import {
  api,
  type RankingConsolidation,
  type AssessmentSession,
  type RankingConsolidationInput,
} from "../api";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

export default function RankingConsolidations() {
  const navigate = useNavigate();
  const [consolidations, setConsolidations] = useState<RankingConsolidation[]>([]);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  // Load-once page: `loading` is derived from whether the first load finished,
  // rather than synced by the effect (which would cascade a render, see
  // AdminUsers.tsx).
  const [loaded, setLoaded] = useState(false);
  const loading = !loaded;
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState<RankingConsolidationInput>({
    name: "",
    assessment_definition_id: 0,
    assessment_session_ids: [],
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.rankingConsolidations(), api.assessmentSessions()])
      .then(([consolidationsRes, sessionsRes]) => {
        if (cancelled) return;
        setConsolidations(consolidationsRes.ranking_consolidations || []);
        setSessions(sessionsRes.assessment_sessions || []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load ranking consolidations.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only published sessions can be consolidated, and only those sharing one
  // rubric. The server re-validates all of this; narrowing the picker just stops
  // a curator being offered combinations guaranteed to fail.
  const publishedSessions = sessions.filter((s) => s.status === "published");
  const definitionId = formData.assessment_definition_id;
  const eligibleSessions = definitionId
    ? publishedSessions.filter((s) => s.assessment_definition?.id === definitionId)
    : [];
  const definitionOptions = Array.from(
    new Map(
      publishedSessions.map((s) => [
        s.assessment_definition.id,
        s.assessment_definition.name,
      ]),
    ).entries(),
  ).map(([id, name]) => ({ id: Number(id), name }));

  const handleStartCreate = () => {
    setIsCreating(true);
    setCreateError(null);
    setFormData((prev) => ({
      ...prev,
      name: "",
      assessment_definition_id: definitionOptions[0]?.id ?? 0,
      assessment_session_ids: [],
      notes: "",
    }));
  };

  const toggleSession = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      assessment_session_ids: prev.assessment_session_ids.includes(id)
        ? prev.assessment_session_ids.filter((sid) => sid !== id)
        : [...prev.assessment_session_ids, id],
    }));
  };
  // The create form lives in its own component so the modal body stays readable
  // and the (long) session picker does not bury the page logic above.
  const renderForm = () => (
    <form onSubmit={handleCreateSubmit}>
      {createError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{createError}</span>
        </div>
      )}

      <div className="admin-field">
        <label htmlFor="consolidation-name">Name</label>
        <input
          id="consolidation-name"
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g. Autumn club ranking"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="consolidation-definition">Assessment rubric</label>
        <select
          id="consolidation-definition"
          value={formData.assessment_definition_id}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              assessment_definition_id: Number(e.target.value),
              // Sessions of another rubric are no longer valid choices.
              assessment_session_ids: [],
            }))
          }
        >
          {definitionOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p className="field-hint">
          Every session must be published and use this same rubric.
        </p>
      </div>

      <div className="admin-field">
        <label>Published sessions</label>
        {eligibleSessions.length === 0 ? (
          <p className="field-hint">No published sessions use this rubric yet.</p>
        ) : (
          <div className="consolidation-session-picker">
            {eligibleSessions.map((s) => (
              <label key={s.id} className="consolidation-session-option">
                <input
                  type="checkbox"
                  checked={formData.assessment_session_ids.includes(s.id)}
                  onChange={() => toggleSession(s.id)}
                />
                <span className="session-option-name">{s.name}</span>
                <span className="session-option-coach">
                  {s.coach_profile?.full_name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="admin-field">
        <label htmlFor="consolidation-notes">Notes</label>
        <textarea
          id="consolidation-notes"
          value={formData.notes || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
          rows={3}
        />
      </div>

      <div className="admin-form-actions">
        <button
          type="submit"
          className="admin-btn admin-btn-add"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create consolidation"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => setIsCreating(false)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!formData.name.trim()) {
      setCreateError("Consolidation name is required.");
      return;
    }
    if (!formData.assessment_definition_id) {
      setCreateError("Select an assessment rubric first.");
      return;
    }
    if (formData.assessment_session_ids.length === 0) {
      setCreateError("Select at least one published session to consolidate.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createRankingConsolidation(formData);
      setIsCreating(false);
      navigate(`/ranking-consolidations/${res.ranking_consolidation.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create ranking consolidation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><p className="loading">Loading...</p></div>;

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Ranking consolidations" />
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page ranking-consolidations-page">
      <PageHeader
        title="Ranking consolidations"
        description="Club-level rankings merged from several coaches' published sessions. Each consolidation is a permanent snapshot."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={handleStartCreate}
          disabled={publishedSessions.length === 0}
        >
          <Plus size={16} />
          New consolidation
        </button>
      </PageHeader>

      {consolidations.length === 0 ? (
        <EmptyState
          title="No ranking consolidations yet"
          description={
            publishedSessions.length === 0
              ? "Publish at least one assessment session first — a consolidation merges published sessions only."
              : "Merge several coaches' published sessions into one club ranking."
          }
        />
      ) : (
        <div className="ranking-consolidation-list">
          {consolidations.map((c) => (
            <Link
              key={c.id}
              to={`/ranking-consolidations/${c.id}`}
              className="ranking-consolidation-row"
            >
              <span className="consolidation-name">{c.name}</span>
              <span className="consolidation-definition">
                {c.assessment_definition?.name}
              </span>
              <span className="consolidation-stat">
                {c.session_count} session{c.session_count === 1 ? "" : "s"}
              </span>
              <span className="consolidation-stat">
                {c.player_count} player{c.player_count === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {isCreating && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3>New ranking consolidation</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsCreating(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {renderForm()}
          </div>
        </div>
      )}
    </div>
  );
}
// __FORM__

