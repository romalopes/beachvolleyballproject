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
  // Any non-withdrawn session may be consolidated, drafts included: a club
  // ranking is assembled from several coaches' work that is often still in
  // progress. What differs is *publishing*, which needs every source finished —
  // so the picker offers drafts but marks them. Withdrawn sessions are excluded
  // because they are no longer a coach's current view of that player.
  const consolidatableSessions = sessions.filter((s) => s.status !== "withdrawn");
  const definitionId = formData.assessment_definition_id;
  const eligibleSessions = definitionId
    ? consolidatableSessions.filter((s) => s.assessment_definition?.id === definitionId)
    : [];
  const definitionOptions = Array.from(
    new Map(
      consolidatableSessions.map((s) => [
        s.assessment_definition.id,
        s.assessment_definition.name,
      ]),
    ).entries(),
  ).map(([id, name]) => ({ id: Number(id), name }));

  // `scheduled_on` is a plain calendar date, so it is parsed as local midnight.
  // `new Date("2026-09-20")` would read it as UTC and can render a day early for
  // anyone west of Greenwich — the same guard the other session pages use.
  const formatSessionDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

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
          Every session must use this same rubric. Draft sessions can be included,
          but each one holds the ranking back until it is published.
        </p>
      </div>

      <div className="admin-field">
        <label id="consolidation-sessions-label">Sessions</label>
        {eligibleSessions.length === 0 ? (
          <p className="field-hint">No sessions use this rubric yet.</p>
        ) : (
          <div className="consolidation-session-picker">
            <div className="session-picker-header">
              <span className="session-picker-count">
                {formData.assessment_session_ids.length} of {eligibleSessions.length} selected
              </span>
              <span className="session-picker-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      assessment_session_ids: eligibleSessions.map((s) => s.id),
                    }))
                  }
                  disabled={formData.assessment_session_ids.length === eligibleSessions.length}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, assessment_session_ids: [] }))
                  }
                  disabled={formData.assessment_session_ids.length === 0}
                >
                  Clear
                </button>
              </span>
            </div>
            <div
              className="session-picker-list"
              role="group"
              aria-labelledby="consolidation-sessions-label"
            >
              {eligibleSessions.map((s) => {
                const checked = formData.assessment_session_ids.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={
                      checked
                        ? "consolidation-session-option selected"
                        : "consolidation-session-option"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSession(s.id)}
                    />
                    <span className="session-option-body">
                      <span className="session-option-name">{s.name}</span>
                      <span className="session-option-meta">
                        <span>{formatSessionDate(s.scheduled_on)}</span>
                        <span className="session-option-sep" aria-hidden="true">·</span>
                        <span>{s.coach_profile?.full_name}</span>
                        <span className="session-option-sep" aria-hidden="true">·</span>
                        <span>{s.ranking?.ranking?.length ?? 0} ranked</span>
                        {s.status === "published" ? null : (
                          <>
                            <span className="session-option-sep" aria-hidden="true">·</span>
                            {/* Names the blocker rather than hiding the session: a
                                draft may be consolidated, it just cannot publish yet. */}
                            <span className="session-option-draft">
                              Draft — holds publishing back
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <p className="field-hint">
          Each session is merged as one coach&apos;s view. A player absent from a
          session is reported, never scored as zero.
        </p>
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
        description="Club-level rankings merged from several coaches' sessions. Each one is a draft until you publish it, and a permanent snapshot thereafter."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={handleStartCreate}
          disabled={consolidatableSessions.length === 0}
        >
          <Plus size={16} />
          New consolidation
        </button>
      </PageHeader>

      {consolidations.length === 0 ? (
        <EmptyState
          title="No ranking consolidations yet"
          description={
            consolidatableSessions.length === 0
              ? "Create at least one assessment session first — a consolidation merges sessions into one club ranking."
              : "Merge several coaches' sessions into one club ranking."
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
              {/* The status is the headline: a draft is not yet the club's
                  official ranking, and a withdrawn one no longer is at all. */}
              <span
                className={
                  c.status === "published"
                    ? "consolidation-stat consolidation-status published"
                    : c.status === "withdrawn"
                      ? "consolidation-stat consolidation-status withdrawn"
                      : "consolidation-stat consolidation-status draft"
                }
              >
                {c.status === "published"
                  ? "Published"
                  : c.status === "withdrawn"
                    ? "Withdrawn"
                    : `Draft — ${c.unpublished_session_count} session${
                        c.unpublished_session_count === 1 ? "" : "s"
                      } unpublished`}
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

