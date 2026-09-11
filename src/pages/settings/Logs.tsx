import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Log, type LogsMeta } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";
import CopyButton from "../../components/CopyButton";

// Audit actions the system can emit.
// To support a new action, just append its value here (and an optional
// human-readable label below) — the filter dropdown picks it up automatically.
const LOG_ACTION_OPTIONS: string[] = ["create", "update", "destroy", "show"];

const LOG_ACTION_LABELS: Record<string, string> = {
  create: "Create",
  update: "Update",
  destroy: "Delete",
  show: "Show",
};

function actionLabel(action: string): string {
  return LOG_ACTION_LABELS[action] ?? action;
}

// Object types the audit trail can reference (polymorphic LogObject types).
// Append new model names here once — the filter dropdown updates automatically.
const LOG_OBJECT_TYPE_OPTIONS: string[] = [
  "User",
  "Skill",
  "Drill",
  "Category",
  "TrainingSession",
  "MediaAsset",
  "Account",
  "Session",
];

const LINE_COUNT_OPTIONS = [100, 250, 500, 1000, 2000];
const PER_PAGE_OPTIONS = [10, 20, 25, 50];

type LogTab = "audit" | "file";

interface AuditFilters {
  user_id: string;
  action: string;
  object_type: string;
  object_id: string;
  date_from: string;
  date_to: string;
  request_id: string;
  search: string;
}

const EMPTY_FILTERS: AuditFilters = {
  user_id: "",
  action: "",
  object_type: "",
  object_id: "",
  date_from: "",
  date_to: "",
  request_id: "",
  search: "",
};

function formatDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function objectsSummary(log: Log): string {
  if (log.objects.length === 0) return "—";
  return log.objects.map((o) => `${o.type} #${o.id}`).join(", ");
}

function LogFileViewer() {
  const [lines, setLines] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .adminSystemLogs(lineCount)
      .then((res) => setLines(res.lines ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lineCount, refreshKey]);

  return (
    <section>
      <h2>Application Log (file)</h2>
      <div className="settings-toolbar">
        <label htmlFor="line-count">Show last:</label>
        <select
          id="line-count"
          value={lineCount}
          onChange={(e) => setLineCount(Number(e.target.value))}
          aria-label="Number of lines"
        >
          {LINE_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} lines
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-add"
          disabled={loading}
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh
        </button>
        <Link to="/settings/system-logs" className="admin-btn">
          Open full page
        </Link>
      </div>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading log...</div>
      ) : lines.length === 0 ? (
        <div className="auth-flash">No log entries found.</div>
      ) : (
        <>
          <div className="log-copy-row">
            <CopyButton text={lines.join("")} label="Copy log" />
          </div>
          <pre className="system-log-viewer">{lines.join("")}</pre>
        </>
      )}
    </section>
  );
}

function AuditLogTable() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<Log[]>([]);
  const [meta, setMeta] = useState<LogsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS);
  const [knownActions, setKnownActions] = useState<string[]>(LOG_ACTION_OPTIONS);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .adminLogs({
        page,
        per_page: perPage,
        user_id: applied.user_id || undefined,
        action: applied.action || undefined,
        object_type: applied.object_type || undefined,
        object_id: applied.object_id || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        request_id: applied.request_id || undefined,
        search: applied.search || undefined,
      })
      .then((res) => {
        setLogs(res.data);
        setMeta(res.meta);
        const seen = res.data.map((l) => l.action).filter(Boolean);
        setKnownActions((prev) => Array.from(new Set([...prev, ...seen])));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, perPage, applied]);

  function updateDraft(key: keyof AuditFilters, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    setApplied({ ...draft });
    setPage(1);
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <section>
      <h2>Audit Log</h2>
      <p className="admin-form-description">
        Database audit trail of user actions (sign-ups, logins, content changes). Click a row
        for full details.
      </p>

      <form onSubmit={applyFilters} className="admin-form audit-log-form">
        <fieldset className="audit-log-fieldset">
          <legend>Filter by</legend>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="audit-user-id">User ID</label>
              <input
                id="audit-user-id"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 42"
                value={draft.user_id}
                onChange={(e) => updateDraft("user_id", e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="audit-action">Action</label>
              <select
                id="audit-action"
                value={draft.action}
                onChange={(e) => updateDraft("action", e.target.value)}
              >
                <option value="">All</option>
                {knownActions.map((a) => (
                  <option key={a} value={a}>
                    {actionLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="audit-object-type">Object type</label>
              <select
                id="audit-object-type"
                value={draft.object_type}
                onChange={(e) => updateDraft("object_type", e.target.value)}
              >
                <option value="">All</option>
                {LOG_OBJECT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="audit-object-id">Object ID</label>
              <input
                id="audit-object-id"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 7"
                value={draft.object_id}
                onChange={(e) => updateDraft("object_id", e.target.value)}
              />
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="audit-date-from">From</label>
              <input
                id="audit-date-from"
                type="date"
                value={draft.date_from}
                onChange={(e) => updateDraft("date_from", e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="audit-date-to">To</label>
              <input
                id="audit-date-to"
                type="date"
                value={draft.date_to}
                onChange={(e) => updateDraft("date_to", e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="audit-request-id">Request ID</label>
              <input
                id="audit-request-id"
                type="text"
                placeholder="req-123"
                value={draft.request_id}
                onChange={(e) => updateDraft("request_id", e.target.value)}
              />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="audit-search">Search</label>
            <input
              id="audit-search"
              type="search"
              placeholder="Search description, action & path"
              value={draft.search}
              onChange={(e) => updateDraft("search", e.target.value)}
            />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-add">
              Search
            </button>
            <button type="button" className="admin-btn" onClick={resetFilters}>
              Clear
            </button>
            <label>
              Per page{" "}
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Entries per page"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </form>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : logs.length === 0 ? (
        <EmptyState title="No logs" description="No audit log entries found." />
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Object</th>
                  <th>Method</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/settings/logs/${log.id}`)}
                  >
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>{log.user?.name ?? "—"}</td>
                    <td>
                      <span className={`tag tag-${log.action}`}>{log.action}</span>
                    </td>
                    <td>
                      <span className="admin-table-name">{log.description}</span>
                    </td>
                    <td>{objectsSummary(log)}</td>
                    <td>{log.method}</td>
                    <td className="text-muted">{log.path ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.total_pages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="admin-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {meta.page} of {meta.total_pages} ({meta.total} total)
              </span>
              <button
                type="button"
                className="admin-btn"
                disabled={page >= meta.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Logs() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LogTab>("audit");

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Logs"
      description="Audit trail of application activity."
      backTo="/settings"
      backLabel="Back to Settings"
    >
      <div className="settings-toolbar" role="tablist" aria-label="Log source">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "audit"}
          className={`admin-btn ${tab === "audit" ? "admin-btn-add" : ""}`}
          onClick={() => setTab("audit")}
          disabled={tab === "audit"}
        >
          Audit Log (database)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "file"}
          className={`admin-btn ${tab === "file" ? "admin-btn-add" : ""}`}
          onClick={() => setTab("file")}
          disabled={tab === "file"}
        >
          Application Log (file)
        </button>
      </div>

      {tab === "audit" ? <AuditLogTable /> : <LogFileViewer />}
    </SettingsLayout>
  );
}
