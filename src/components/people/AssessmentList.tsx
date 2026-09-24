import type { Assessment } from "../../api";
import {
  assessmentRecorderLabel,
  assessmentRubricLabel,
  assessmentStatusLabel,
} from "../../utils/assessments";
import EmptyState from "../EmptyState";
import Tag from "../Tag";
import ScoreBadge from "./ScoreBadge";

interface AssessmentListProps {
  assessments?: Assessment[];
  emptyTitle?: string;
  emptyDescription?: string;
  showHistory?: boolean;
  onEdit?: (assessment: Assessment) => void;
}

export default function AssessmentList({
  assessments,
  emptyTitle = "No assessments yet",
  emptyDescription = "Coaching assessments will appear here once recorded.",
  showHistory = true,
  onEdit,
}: AssessmentListProps) {
  const rows = assessments ?? [];
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const latestByRubric = new Map<string, Assessment>();
  for (const row of rows) {
    const key = row.category_id != null ? `category:${row.category_id}` : `custom:${row.custom_category ?? "unspecified"}`;
    if (!latestByRubric.has(key)) latestByRubric.set(key, row);
  }

  return (
    <div className="assessment-list">
      <ul className="assessment-latest-list">
        {[...latestByRubric.values()].map((row) => (
          <li key={row.id} className="assessment-latest-row">
            <div>
              <strong>{assessmentRubricLabel(row)}</strong>
              <div className="assessment-meta">
                <Tag variant={row.status === "active" ? "teal" : "default"}>
                  {assessmentStatusLabel(row.status)}
                </Tag>
                <span>{assessmentRecorderLabel(row)}</span>
              </div>
            </div>
            <ScoreBadge score={row.score} />
          </li>
        ))}
      </ul>
      {showHistory && rows.length > latestByRubric.size && (
        <details className="assessment-history">
          <summary>Assessment history ({rows.length})</summary>
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="assessment-history-row">
                <div>
                  <strong>{assessmentRubricLabel(row)}</strong>
                  <span>{new Date(row.created_at).toLocaleDateString()} · {assessmentRecorderLabel(row)}</span>
                  {row.notes && <p>{row.notes}</p>}
                </div>
                <div className="assessment-row-actions">
                  <Tag>{assessmentStatusLabel(row.status)}</Tag>
                  <ScoreBadge score={row.score} />
                  {onEdit && <button type="button" className="admin-btn" onClick={() => onEdit(row)}>Edit</button>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
