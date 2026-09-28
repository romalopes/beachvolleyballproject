import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  Trophy,
  Info,
  Trash2,
  Undo2,
  RefreshCw,
} from "lucide-react";
import {
  api,
  type RankingConsolidation,
  type RankingConsolidationSource,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";

/**
 * A readable local timestamp. Withdrawal times are shown against published ones to
 * explain *why* a session is still counted, so the order and the day both matter —
 * a bare date would hide a same-day ordering.
 */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function RankingConsolidationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const consolidationId = Number(id);
  // Impersonation is excluded on purpose: an admin viewing the app as somebody
  // else must not be offered the destructive and restore controls.
  const isAdmin =
    !!user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;

  const [consolidation, setConsolidation] =
    useState<RankingConsolidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // `loading` is derived from the id on screen instead of being synced by an
  // effect — an effect that called `setLoading` would cascade a second render on
  // every navigation. Same approach as AdminUsers.tsx.
  const invalidId = !Number.isFinite(consolidationId);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const loading = !invalidId && loadedId !== consolidationId;

  useEffect(() => {
    if (!Number.isFinite(consolidationId)) return;
    let cancelled = false;
    api
      .rankingConsolidation(consolidationId)
      .then((res) => {
        if (cancelled) return;
        setConsolidation(res.ranking_consolidation);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load ranking consolidation.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoadedId(consolidationId);
      });
    return () => {
      cancelled = true;
    };
  }, [consolidationId]);

  if (loading)
    return (
      <div className="page">
        <p className="loading">Loading...</p>
      </div>
    );

  if (invalidId || error || !consolidation) {
    return (
      <div className="page">
        <p className="session-back-link">
          <Link to="/ranking-consolidations" className="back-link">
            <ArrowLeft size={14} />
            All consolidations
          </Link>
        </p>
        <PageHeader title="Ranking consolidation" />
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>
            {invalidId
              ? "Invalid ranking consolidation id."
              : error || "Ranking consolidation not found."}
          </span>
        </div>
      </div>
    );
  }

  const sessions = consolidation.assessment_sessions || [];
  const rows = consolidation.rows || [];
  // `included_in_ranking` is the server's answer to "are these scores in the numbers
  // on screen", and it is the only sound one. Deriving it from live status is the bug
  // this page used to have: a source withdrawn *after* publication is still in a
  // frozen snapshot, so status says "withdrawn" while its scores are still averaged
  // in — and the page would blank the column and report the wrong denominator for a
  // ranking that plainly contains the session.
  const contributingSessions = sessions.filter((s) => s.included_in_ranking);
  const sessionCount = contributingSessions.length;
  // Withdrawn sources split by *when* they were retracted, because for a published
  // ranking the two cases are different facts: one was skipped by the merge, the other
  // is still being counted.
  const excludedSessions = sessions.filter(
    (s) => s.status === "withdrawn" && !s.included_in_ranking,
  );
  const staleSessions = sessions.filter(
    (s) => s.status === "withdrawn" && s.included_in_ranking,
  );
  // Published sources the merge skipped and that have since been restored. They score
  // again, but the frozen ranking is not using them — the mirror of a stale
  // withdrawal, and the case where the ranking under-reports without saying so.
  const restoredSessions = sessions.filter(
    (s) => s.status === "published" && !s.included_in_ranking,
  );
  // A player ranked by fewer sessions than contributed gets an explicit coverage
  // badge — never a zero for the sessions they missed (D21).
  const partialRows = rows.filter((r) => r.coverage < sessionCount);
  // D21 never blocks a merge, so the reason it proceeded is what gets shown. A
  // withdrawn source is reported by the separate notices below, so it is kept out of
  // this list.
  const warningSessions = sessions.filter(
    (s) => (s.incomplete_count ?? 0) > 0 && s.status !== "withdrawn",
  );
  // A consolidation is assembled as a draft and frozen when published. Only a
  // *draft* source blocks publishing; a withdrawn one is excluded from the merge
  // and reported separately below.
  const isPublished = consolidation.status === "published";
  const pendingSessions = sessions.filter((s) => s.status === "draft");
  const canPublish = !isPublished && pendingSessions.length === 0;
  const isWithdrawn = consolidation.status === "withdrawn";
  // A withdrawn ranking is inert: only an admin may restore, edit or delete it.

  const runAction = async (
    key: string,
    fn: () => Promise<{ ranking_consolidation: RankingConsolidation }>,
  ) => {
    setBusyAction(key);
    setActionError(null);
    try {
      const res = await fn();
      setConsolidation(res.ranking_consolidation);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "The action could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublish = () =>
    runAction("publish", () =>
      api.publishRankingConsolidation(consolidation.id),
    );

  // Withdrawing is reversible, so it does not need a typed confirmation the way a
  // hard delete does — but it is a retraction of a claim about named players, so
  // it is still confirmed rather than one accidental click away.
  const handleWithdraw = async () => {
    if (
      !window.confirm(
        "Withdraw this ranking? It stops being the club's current result, and only an admin can restore it.",
      )
    ) {
      return;
    }
    await runAction("withdraw", () =>
      api.withdrawRankingConsolidation(consolidation.id),
    );
  };

  const handleRestore = (to: "draft" | "published") =>
    runAction("restore", () =>
      api.restoreRankingConsolidation(consolidation.id, to),
    );

  // Recalculating rewrites a published result people may already have acted on, so
  // unlike withdrawing it is confirmed, and it says what will change in both
  // directions: stale sources drop out, restored ones come back in.
  const handleRecalculate = async () => {
    const label = (s: RankingConsolidationSource) =>
      s.name || `Session #${s.assessment_session_id}`;
    const changes: string[] = [];
    if (staleSessions.length > 0) {
      changes.push(
        `the scores from ${staleSessions.map(label).join(", ")} will be removed`,
      );
    }
    if (restoredSessions.length > 0) {
      changes.push(
        `the scores from ${restoredSessions.map(label).join(", ")} will be added`,
      );
    }
    if (
      !window.confirm(
        `Recalculate this ranking? ${changes.join(", and ")}, and every result recomputed. The original publication date is kept, and the correction is recorded.`,
      )
    ) {
      return;
    }
    await runAction("recalculate", () =>
      api.recalculateRankingConsolidation(consolidation.id),
    );
  };

  // The action, worded for the direction it will actually move the ranking in. Shown
  // once, inside whichever notice is outstanding, and driven by `can_recalculate` so a
  // coach is never offered a correction they may not make. It disappears when the
  // server reports nothing left to correct.
  const recalculateControl = () =>
    consolidation.can_recalculate ? (
      <>
        <div className="admin-form-actions session-actions">
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => void handleRecalculate()}
            disabled={busyAction !== null}
          >
            <RefreshCw size={14} />
            {busyAction === "recalculate"
              ? "Recalculating..."
              : restoredSessions.length > 0 && staleSessions.length === 0
                ? "Recalculate to include them"
                : staleSessions.length > 0 && restoredSessions.length === 0
                  ? "Recalculate without them"
                  : "Recalculate"}
          </button>
        </div>
        <p className="field-hint">
          Recalculating rebuilds every result from the sessions as they are now.
          The original publication date is kept and the correction is recorded
          against your name.
        </p>
      </>
    ) : consolidation.recalculable ? (
      <p className="field-hint">
        A curator or admin can recalculate this ranking to bring it up to date.
      </p>
    ) : null;

  // Deleting is the one irreversible action, so it names what is destroyed.
  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete "${consolidation.name}"? This removes the ranking and its ${rows.length} result row(s) and cannot be undone. Withdrawing is reversible.`,
      )
    ) {
      return;
    }
    setBusyAction("delete");
    setActionError(null);
    try {
      await api.deleteRankingConsolidation(consolidation.id);
      navigate("/ranking-consolidations");
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "The ranking could not be deleted.",
      );
      setBusyAction(null);
    }
  };

  // A draft is the only state a non-admin may delete. A published ranking and a
  // withdrawn one are admin-only, matching the server.
  const canDelete = isAdmin || consolidation.status === "draft";

  // The withdrawn-source notice is for the people accountable for the ranking — its
  // author, a curator, or an admin. It explains that a source was retracted and so
  // is not counted, which is exactly the kind of thing that should not be left for
  // someone to notice by comparing two rankings.
  const isOversight = isAdmin || !!user?.roles?.includes("curator");
  const canSeeWithdrawnNotice =
    isOversight || consolidation.created_by_id === user?.id;

  return (
    <div className="page ranking-consolidation-detail-page">
      <p className="session-back-link">
        <Link to="/ranking-consolidations" className="back-link">
          <ArrowLeft size={14} />
          All consolidations
        </Link>
      </p>

      <PageHeader
        title={consolidation.name}
        description={consolidation.notes || undefined}
      >
        <div className="session-meta">
          <span
            className={
              isPublished
                ? "consolidation-status published"
                : isWithdrawn
                  ? "consolidation-status withdrawn"
                  : "consolidation-status draft"
            }
          >
            {consolidation.status_label}
          </span>
          <span className="session-meta-item">
            <Trophy size={14} />
            {rows.length} ranked player{rows.length === 1 ? "" : "s"}
          </span>
          <span className="session-meta-item">
            Rubric: {consolidation.assessment_definition?.name}
          </span>
        </div>
        {/* Only a draft can be published, and only once every source session is.
            The button is disabled rather than hidden while sessions are pending,
            with the reason spelled out below it. */}
        {!isPublished && !isWithdrawn && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => void handlePublish()}
              disabled={!canPublish || busyAction !== null}
            >
              {busyAction === "publish" ? "Publishing..." : "Publish ranking"}
            </button>
          </div>
        )}
        {/* Withdrawing is the ordinary, reversible retraction of a published
            ranking, so it is offered to anyone who may retract. */}
        {isPublished && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => void handleWithdraw()}
              disabled={busyAction !== null}
            >
              {busyAction === "withdraw"
                ? "Withdrawing..."
                : "Withdraw ranking"}
            </button>
          </div>
        )}
        {/* A withdrawn ranking is inert. Only an admin brings it back, and
            restoring to published re-derives the snapshot from current sources. */}
        {isWithdrawn && isAdmin && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => void handleRestore("published")}
              disabled={busyAction !== null}
            >
              <Undo2 size={14} />
              {busyAction === "restore"
                ? "Restoring..."
                : "Restore to published"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => void handleRestore("draft")}
              disabled={busyAction !== null}
            >
              Restore to draft
            </button>
          </div>
        )}
      </PageHeader>

      {canDelete && (
        <div className="admin-form-actions session-actions consolidation-danger-zone">
          <button
            type="button"
            className="admin-btn admin-btn-remove"
            onClick={() => void handleDelete()}
            disabled={busyAction !== null}
          >
            <Trash2 size={14} />
            {busyAction === "delete" ? "Deleting..." : "Delete permanently"}
          </button>
          <p className="field-hint">
            Removes the ranking and its result rows for good. Withdrawing is the
            reversible option.
          </p>
        </div>
      )}

      {actionError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {!isPublished && (
        <div className="consolidation-immutable-note">
          <Info size={16} />
          <span>
            {pendingSessions.length > 0 ? (
              <>
                This ranking is a draft. Publishing is blocked until every
                source session is published —{" "}
                <strong>
                  {pendingSessions
                    .map((s) => s.name || `Session #${s.assessment_session_id}`)
                    .join(", ")}
                </strong>{" "}
                {pendingSessions.length === 1 ? "is" : "are"} still unfinished.
                The numbers shown are rebuilt from the sessions at the moment
                you publish, so they will reflect their final scores.
              </>
            ) : (
              <>
                Every source session is published, so this ranking can be frozen
                as the club&apos;s official result. The numbers shown are
                rebuilt from the sessions at the moment you publish, so they
                will reflect their final scores.
              </>
            )}
          </span>
        </div>
      )}

      {isWithdrawn && (
        <div className="consolidation-immutable-note">
          <Info size={16} />
          <span>
            This ranking was withdrawn and is no longer the club&apos;s result.
            Its rows are kept, so the record that it was once published
            survives. Only an admin can restore it — to draft, or back to
            published, which re-derives the ranking from the sessions as they
            are now.
          </span>
        </div>
      )}

      {isPublished && (
        <div className="consolidation-immutable-note">
          <Info size={16} />
          <span>
            This is a permanent snapshot frozen at publication. Later changes to
            the source sessions — including withdrawing one — do not alter it.
          </span>
        </div>
      )}

      {canSeeWithdrawnNotice && excludedSessions.length > 0 && (
        <div className="consolidation-withdrawn-banner" role="status">
          <AlertCircle size={16} />
          <div className="consolidation-warning-body">
            <strong>
              {excludedSessions.length} source session
              {excludedSessions.length === 1 ? " was" : "s were"} withdrawn
              before this ranking was computed, so{" "}
              {excludedSessions.length === 1 ? "its" : "their"} scores{" "}
              {excludedSessions.length === 1 ? "is" : "are"} already excluded.
            </strong>
            <ul className="consolidation-warning-list">
              {excludedSessions.map((s) => (
                <li key={s.assessment_session_id}>
                  <span className="consolidation-warning-session">
                    <Link
                      to={`/assessment-sessions/${s.assessment_session_id}`}
                    >
                      {s.name || `Session #${s.assessment_session_id}`}
                    </Link>
                  </span>
                  <span className="consolidation-warning-detail">
                    {s.coach_name
                      ? `Withdrawn by ${s.coach_name}`
                      : "Withdrawn"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="consolidation-warning-note">
              The session is still listed as a source, but its scores are
              excluded entirely rather than counted as zero. It does not hold up
              publication.
            </p>
          </div>
        </div>
      )}

      {staleSessions.length > 0 && (
        <div className="consolidation-withdrawn-banner" role="status">
          <AlertCircle size={16} />
          <div className="consolidation-warning-body">
            <strong>
              {staleSessions.length} source session
              {staleSessions.length === 1 ? " was" : "s were"} withdrawn after
              this ranking was published, and{" "}
              {staleSessions.length === 1 ? "its" : "their"} scores are still
              counted in it.
            </strong>
            <ul className="consolidation-warning-list">
              {staleSessions.map((s) => (
                <li key={s.assessment_session_id}>
                  <span className="consolidation-warning-session">
                    <Link
                      to={`/assessment-sessions/${s.assessment_session_id}`}
                    >
                      {s.name || `Session #${s.assessment_session_id}`}
                    </Link>
                  </span>
                  <span className="consolidation-warning-detail">
                    {s.coach_name
                      ? `Withdrawn by ${s.coach_name}`
                      : "Withdrawn"}
                    {s.withdrawn_at
                      ? ` · ${formatDateTime(s.withdrawn_at)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="consolidation-warning-note">
              Publishing does not cascade, so this ranking kept the numbers it
              was frozen with — the results below still include{" "}
              {staleSessions.length === 1 ? "that session" : "those sessions"}.
              The ranking is not wrong; it is simply older than the withdrawal.
            </p>
            {recalculateControl()}
          </div>
        </div>
      )}

      {restoredSessions.length > 0 && (
        <div className="consolidation-withdrawn-banner" role="status">
          <AlertCircle size={16} />
          <div className="consolidation-warning-body">
            <strong>
              {restoredSessions.length} source session
              {restoredSessions.length === 1 ? " was" : "s were"} restored to
              published after this ranking was computed, and{" "}
              {restoredSessions.length === 1 ? "its" : "their"} scores are
              missing from it.
            </strong>
            <ul className="consolidation-warning-list">
              {restoredSessions.map((s) => (
                <li key={s.assessment_session_id}>
                  <span className="consolidation-warning-session">
                    <Link
                      to={`/assessment-sessions/${s.assessment_session_id}`}
                    >
                      {s.name || `Session #${s.assessment_session_id}`}
                    </Link>
                  </span>
                  <span className="consolidation-warning-detail">
                    {s.coach_name
                      ? `Scored by ${s.coach_name}`
                      : "Published again"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="consolidation-warning-note">
              The session is scoring again, but this ranking was frozen without
              it, so the results below are lower than they should be. Unlike a
              stale withdrawal this is a genuine shortfall, not merely an older
              result.
            </p>
            {recalculateControl()}
          </div>
        </div>
      )}

      {warningSessions.length > 0 && (
        <div className="consolidation-warning-banner" role="status">
          <AlertCircle size={16} />
          <div className="consolidation-warning-body">
            <strong>
              Some source sessions had incomplete scores and were merged anyway.
            </strong>
            <ul className="consolidation-warning-list">
              {warningSessions.map((s) => (
                <li key={s.assessment_session_id}>
                  <span className="consolidation-warning-session">
                    {s.name || `Session #${s.assessment_session_id}`}
                  </span>
                  <span className="consolidation-warning-detail">
                    {s.incomplete_count} incomplete:{" "}
                    {s.incomplete_players.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="consolidation-warning-note">
              Incomplete players are absent from those sessions' scores rather
              than counted as zero, so their average is over fewer sessions than
              the coverage badge shows.
            </p>
          </div>
        </div>
      )}

      <section className="ranking-section">
        <div className="ranking-section-header">
          <h4>Club ranking</h4>
        </div>
        <div className="ranking-table-wrapper">
          <table className="session-ranking-table consolidation-ranking-table">
            <thead>
              <tr>
                <th className="col-rank">Rank</th>
                <th className="col-player">Player</th>
                {sessions.map((s) => (
                  <th key={s.assessment_session_id} className="col-score">
                    <span className="consolidation-session-name">
                      {s.name || `Session #${s.assessment_session_id}`}
                    </span>
                    {s.coach_name && (
                      <span className="consolidation-coach-name">
                        {s.coach_name}
                      </span>
                    )}
                  </th>
                ))}
                <th className="col-score">Average</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.player_profile_id} className="ranking-row">
                  <td className="cell-rank">
                    <span className={`rank-badge rank-${row.rank}`}>
                      #{row.rank}
                    </span>
                  </td>
                  <td className="cell-player">
                    <span className="player-name">{row.player_name}</span>
                    {row.coverage < sessionCount && (
                      <span className="consolidation-coverage-badge">
                        {row.coverage}/{sessionCount} sessions
                      </span>
                    )}
                  </td>
                  {sessions.map((s) => {
                    const score =
                      row.coach_scores?.[String(s.assessment_session_id)];
                    return (
                      <td key={s.assessment_session_id} className="cell-score">
                        {score ?? (
                          <span className="consolidation-not-ranked">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="cell-score">
                    <span className="overall-score-badge">
                      {row.average_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {partialRows.length > 0 && (
        <section className="ranking-section incomplete-section">
          <div className="ranking-section-header">
            <AlertCircle size={18} className="ranking-icon alert" />
            <h4>Not ranked by every session ({partialRows.length})</h4>
          </div>
          <p className="ranking-section-desc">
            These players were absent from some source sessions. Their average
            covers only the sessions that ranked them — they were not scored
            zero for the others.
          </p>
          <ul className="incomplete-player-list">
            {partialRows.map((row) => (
              <li
                key={row.player_profile_id}
                className="incomplete-player-item"
              >
                <span className="player-name">{row.player_name}</span>
                <span className="incomplete-categories-badge">
                  Ranked by {row.coverage} of {sessionCount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ranking-section">
        <div className="ranking-section-header">
          <h4>Source sessions ({sessions.length})</h4>
        </div>
        <ul className="consolidation-source-list">
          {sessions.map((s) => (
            <li
              key={s.assessment_session_id}
              className="consolidation-source-item"
            >
              <Link to={`/assessment-sessions/${s.assessment_session_id}`}>
                {s.name || `Session #${s.assessment_session_id}`}
              </Link>
              <span className="session-option-coach">{s.coach_name}</span>
              <span className="consolidation-stat">
                {s.ranking_snapshot?.length || 0} ranked
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
