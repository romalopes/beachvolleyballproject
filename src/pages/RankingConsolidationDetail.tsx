import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, Trophy, Info } from "lucide-react";
import { api, type RankingConsolidation } from "../api";
import PageHeader from "../components/PageHeader";

export default function RankingConsolidationDetail() {
  const { id } = useParams<{ id: string }>();
  const consolidationId = Number(id);

  const [consolidation, setConsolidation] = useState<RankingConsolidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConsolidation = async () => {
    if (!Number.isFinite(consolidationId)) {
      setError("Invalid ranking consolidation id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.rankingConsolidation(consolidationId);
      setConsolidation(res.ranking_consolidation);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load ranking consolidation.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConsolidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consolidationId]);

  if (loading) return <div className="page"><p className="loading">Loading...</p></div>;

  if (error || !consolidation) {
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
          <span>{error || "Ranking consolidation not found."}</span>
        </div>
      </div>
    );
  }

  const sessions = consolidation.assessment_sessions || [];
  const rows = consolidation.rows || [];
  const sessionCount = sessions.length;
  // A player ranked by fewer sessions than were consolidated gets an explicit
  // coverage badge — never a zero for the sessions they missed (D21).
  const partialRows = rows.filter((r) => r.coverage < sessionCount);
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
          <span className="session-meta-item">
            <Trophy size={14} />
            {rows.length} ranked player{rows.length === 1 ? "" : "s"}
          </span>
          <span className="session-meta-item">
            Rubric: {consolidation.assessment_definition?.name}
          </span>
        </div>
      </PageHeader>

      <div className="consolidation-immutable-note">
        <Info size={16} />
        <span>
          This is a permanent snapshot taken when it was created. Later changes to
          the source sessions — including withdrawing one — do not alter it.
        </span>
      </div>

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
                    {s.name || `Session #${s.assessment_session_id}`}
                    {s.coach_name && (
                      <span className="consolidation-coach-name">{s.coach_name}</span>
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
                    <span className={`rank-badge rank-${row.rank}`}>#{row.rank}</span>
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
                    const score = row.coach_scores?.[String(s.assessment_session_id)];
                    return (
                      <td key={s.assessment_session_id} className="cell-score">
                        {score ?? <span className="consolidation-not-ranked">—</span>}
                      </td>
                    );
                  })}
                  <td className="cell-score">
                    <span className="overall-score-badge">{row.average_score}</span>
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
            covers only the sessions that ranked them — they were not scored zero
            for the others.
          </p>
          <ul className="incomplete-player-list">
            {partialRows.map((row) => (
              <li key={row.player_profile_id} className="incomplete-player-item">
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
            <li key={s.assessment_session_id} className="consolidation-source-item">
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
