import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Assessment, type AssessmentStatus, type PaginationMeta } from "../api";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/settings/Pagination";
import Tag from "../components/Tag";
import { ASSESSMENT_STATUSES, assessmentStatusLabel } from "../utils/assessments";

/** Page size for the assessment catalogue (the API's own default). */
const PER_PAGE = 20;

/**
 * Assessment catalogue: every rating that exists for the signed-in viewer,
 * newest first. A read/navigation surface — recording and editing stay on the
 * player page (and the session page for in-session rows), because an assessment
 * always names the player it is about.
 *
 * The API always scopes the list to `visible_to(Current.user)`: active rows by
 * default, drafts and withdrawn rows only for their stakeholders and oversight.
 * No query parameter widens that, so the status filter only changes which of
 * the rows you may already see are shown.
 */
export default function Assessments() {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [status, setStatus] = useState<AssessmentStatus | "">("");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .assessments({
        ...(status ? { status } : {}),
        mine: mineOnly || undefined,
        page,
        per_page: PER_PAGE,
      })
      .then((response) => {
        if (cancelled) return;
        setRows(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load assessments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, mineOnly, page]);

  return (
    <div className="page">
      <PageHeader
        title="Assessments"
        description="Coaching ratings of players, newest first."
      />

      <div className="people-toolbar">
        <label>
          Status
          <select
            aria-label="Filter assessments by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AssessmentStatus | "");
              setPage(1);
            }}
          >
            <option value="">Published (default)</option>
            {ASSESSMENT_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="schedule-mine">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => {
              setMineOnly(event.target.checked);
              setPage(1);
            }}
          />
          Only rows I recorded
        </label>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No assessments found"
          description="Nothing exists for this filter. Record an assessment from a player's page."
        />
      ) : (
        <ul className="people-list">
          {rows.map((row) => (
            <li key={row.id} className="people-row">
              <div className="people-identity">
                <Link to={`/players/${row.player_profile_id}`} className="people-name">
                  Player #{row.player_profile_id}
                </Link>
                <span className="people-contact">
                  {row.category ? (
                    row.category.name
                  ) : (
                    row.custom_category ?? "Unspecified rubric"
                  )}
                  {row.training_session_id && (
                    <>
                      {" · "}
                      <Link to={`/training/${row.training_session_id}`}>session</Link>
                    </>
                  )}
                </span>
                {row.notes && <span className="people-meta">{row.notes}</span>}
              </div>
              <div className="assessment-row-actions">
                {row.created_by && (
                  <span className="people-meta">{row.created_by.name}</span>
                )}
                <Tag variant={row.status === "active" ? "teal" : "default"}>
                  {assessmentStatusLabel(row.status)}
                </Tag>
                <span className="score-badge" title={`${row.score}/100`}>
                  {row.score == null
                    ? "Not rated yet"
                    : `${row.score}/100 · ${row.ten_scale}/10 · ${row.five_scale}/5`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={meta.per_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
