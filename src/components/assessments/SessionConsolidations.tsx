import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import type { AssessmentSessionConsolidation } from "../../api";

interface SessionConsolidationsProps {
  consolidations: AssessmentSessionConsolidation[];
}

/**
 * The club rankings this session was merged into.
 *
 * The point of the tab is the *consequence* view: a coach who is about to retract a
 * session needs to know which published results it is standing behind, before they
 * pull it. So each entry says whether this session's scores are actually in that
 * ranking's numbers — a session that stays attached without contributing is a very
 * different fact from one that is being counted, and only the snapshot knows which.
 */
export default function SessionConsolidations({
  consolidations,
}: SessionConsolidationsProps) {
  if (!consolidations || consolidations.length === 0) {
    return (
      <div className="session-ranking-empty">
        <p>
          This session has not been merged into any ranking consolidation yet. It
          will be listed here once a club ranking is built from it.
        </p>
      </div>
    );
  }

  return (
    <div className="session-consolidations">
      <p className="session-consolidations-intro">
        This session is a source of {consolidations.length} club ranking
        {consolidations.length === 1 ? "" : "s"}. Retracting it does not change{" "}
        {consolidations.length === 1 ? "that ranking" : "those rankings"} on its own
        — a published result keeps the figures it was frozen with until someone
        recalculates it.
      </p>
      <ul className="session-consolidations-list">
        {consolidations.map((consolidation) => (
          <li
            key={consolidation.id}
            className="session-consolidations-item"
          >
            <div className="session-consolidations-main">
              <Link
                to={`/ranking-consolidations/${consolidation.id}`}
                className="session-consolidations-link"
              >
                {consolidation.name || `Ranking #${consolidation.id}`}
              </Link>
              <span
                className={`consolidation-stat consolidation-status ${consolidation.status}`}
              >
                {consolidation.status_label}
              </span>
            </div>
            {!consolidation.included_in_ranking && (
              <p className="session-consolidations-excluded">
                <AlertCircle size={14} />
                <span>
                  Not included in this ranking&apos;s scores. It was left out when the
                  ranking was built or last recalculated.
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
