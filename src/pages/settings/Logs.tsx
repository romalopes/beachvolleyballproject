import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Log, type LogsMeta } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [meta, setMeta] = useState<LogsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .adminLogs({
        page,
        per_page: 25,
                      action_filter: actionFilter || undefined,
      })
      .then((res) => {
        setLogs(res.data);
        setMeta(res.meta);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

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
      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      <div className="settings-toolbar">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="destroy">Delete</option>
          <option value="show">Show</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : logs.length === 0 ? (
        <EmptyState title="No logs" description="Audit log entries will appear here." />
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
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.user?.name ?? "—"}</td>
                    <td>
                      <span className={`tag tag-${log.action}`}>{log.action}</span>
                    </td>
                    <td>
                      <Link to={`/settings/logs/${log.id}`} className="admin-table-name">
                        {log.description}
                      </Link>
                    </td>
                    <td>
                      {log.objects.length > 0
                        ? log.objects
                            .map((o) => `${o.type} #${o.id}`)
                            .join(", ")
                        : "—"}
                    </td>
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
    </SettingsLayout>
  );
}
