import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";

const LINE_OPTIONS = [100, 500, 1000, 2000, 5000];

export default function SystemLogs() {
  const { user } = useAuth();
  const [lines, setLines] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .adminSystemLogs(lineCount)
      .then((res) => setLines(res.lines ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lineCount]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Rails log file"
      description={`Last ${lineCount} lines of log/${import.meta.env.DEV ? "development" : "production"}.log.`}
      backTo="/settings/logs"
      backLabel="Back to Logs"
    >
      <div className="settings-toolbar">
        <select
          value={lineCount}
          onChange={(e) => setLineCount(Number(e.target.value))}
          aria-label="Number of lines"
        >
          {LINE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Last {n} lines
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-add"
          disabled={loading}
          onClick={() => setLineCount((c) => c)}
        >
          Refresh
        </button>
      </div>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading log...</div>
      ) : lines.length === 0 ? (
        <div className="auth-flash">No log entries found.</div>
      ) : (
        <pre className="system-log-viewer">{lines.join("")}</pre>
      )}
    </SettingsLayout>
  );
}