import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Log } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";

export default function LogDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [log, setLog] = useState<Log | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .adminLog(id)
      .then((res) => setLog(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <SettingsLayout title="Log" backTo="/settings/logs" backLabel="Back to Logs">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!log) {
    return (
      <SettingsLayout title="Log" backTo="/settings/logs" backLabel="Back to Logs">
        <EmptyState title="Log not found" />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="Log"
      description={log.description}
      backTo="/settings/logs"
      backLabel="Back to Logs"
    >
      <div className="detail-section">
        <h2>Details</h2>
        <dl className="detail-list">
          <dt>Date/Time</dt>
          <dd>{new Date(log.created_at).toLocaleString()}</dd>

          <dt>Action</dt>
          <dd>
            <span className={`tag tag-${log.action}`}>{log.action}</span>
          </dd>

          <dt>Description</dt>
          <dd>{log.description}</dd>

          <dt>User</dt>
          <dd>{log.user ? `${log.user.name} (${log.user.email_address})` : "—"}</dd>

          <dt>HTTP Method</dt>
          <dd>{log.method}</dd>

          <dt>Path</dt>
          <dd>{log.path ?? "—"}</dd>

          <dt>Status</dt>
          <dd>{log.status ?? "—"}</dd>

          <dt>Request ID</dt>
          <dd>{log.request_id ?? "—"}</dd>

          <dt>IP Address</dt>
          <dd>{log.ip_address ?? "—"}</dd>

          <dt>User Agent</dt>
          <dd>{log.user_agent ?? "—"}</dd>
        </dl>
      </div>

      <div className="detail-section">
        <h2>Associated Objects</h2>
        {log.objects.length === 0 ? (
          <EmptyState title="No associated objects" />
        ) : (
          <ul className="settings-link-list">
            {log.objects.map((o) => (
              <li key={`${o.type}-${o.id}`}>
                                 {o.exists && o.type === "Skill" && (
                  <Link to={`/settings/skills/${o.slug ?? o.id}`}>
                    {o.type} #{o.id}
                    {o.label ? ` — ${o.label}` : ""}
                  </Link>
                )}
                {o.exists && o.type === "Drill" && (
                  <Link to={`/settings/drills/${o.slug ?? o.id}`}>
                    {o.type} #{o.id}
                    {o.label ? ` — ${o.label}` : ""}
                  </Link>
                )}
                {o.exists && o.type === "Category" && (
                  <Link to={`/settings/categories/${o.slug ?? o.id}`}>
                    {o.type} #{o.id}
                    {o.label ? ` — ${o.label}` : ""}
                  </Link>
                )}
                {o.exists && o.type === "User" && (
                  <Link to="/admin/users">
                    {o.type} #{o.id}
                    {o.label ? ` — ${o.label}` : ""}
                  </Link>
                )}
                {o.exists && !["Skill", "Drill", "Category", "User"].includes(o.type) && (
                  <span>
                    {o.type} #{o.id}
                    {o.label ? ` — ${o.label}` : ""}
                  </span>
                )}
                {!o.exists && (
                  <span className="text-muted">
                    {o.type} #{o.id} (deleted)
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsLayout>
  );
}
