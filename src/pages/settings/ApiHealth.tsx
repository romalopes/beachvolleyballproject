import { useMemo, useState } from "react";
import { BACK_END_VERSION } from "../../constants/versions";
import { getApiToken } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import ResponseInspector from "../../components/settings/apiHealth/ResponseInspector";
import WriteSandbox from "../../components/settings/apiHealth/WriteSandbox";
import {
  API_CHECKS,
  isWriteCheck,
  type ApiCheck,
  type CheckResult,
} from "../../services/apiHealth/apiHealthConfig";
import { runCheck, runWriteFlow } from "../../services/apiHealth/healthRunner";

const methodClass: Record<string, string> = {
  GET: "health-method-get",
  POST: "health-method-post",
  PATCH: "health-method-patch",
  DELETE: "health-method-delete",
};

function latencyClass(rating: string): string {
  if (rating === "excellent") return "health-pass";
  if (rating === "good") return "health-neutral";
  return "health-fail";
}

function StatusBadge({ passed }: { passed: boolean | undefined }) {
  const cls =
    passed == null ? "health-neutral" : passed ? "health-pass" : "health-fail";
  const label = passed == null ? "—" : passed ? "PASS" : "FAIL";
  return <span className={`health-badge ${cls}`}>{label}</span>;
}


// Renders a 2-column definition list (key/value pairs) for the
// infrastructure sections in /api/v1/health/detailed. Values that are
// null/undefined render as "—" so the layout stays consistent.
function InfoGrid({ entries }: { entries: [string, unknown][] }) {
  return (
    <dl className="health-info-grid">
      {entries.map(([key, value]) => (
        <div key={key} className="health-info-row">
          <dt className="health-info-key">{key}</dt>
          <dd className="health-info-value">
            {value === null || value === undefined || value === ""
              ? "—"
              : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface DetailedPayload {
  environment?: string;
  database_details?: Record<string, string | number | boolean | null>;
  server?: Record<string, string | number | boolean | null>;
  endpoint?: Record<string, string | number | boolean | null>;
  counts?: Record<string, number>;
}

function InfrastructurePanel({ detailed }: { detailed: CheckResult | undefined }) {
  const payload = detailed?.payload as DetailedPayload | undefined;
  if (!payload) return null;

  const db = payload.database_details;
  const hasDbData =
    db && Object.values(db).some((v) => v !== null && v !== undefined);

  return (
    <div className="health-infra-panel">
      <h2 className="health-infra-title">Infrastructure</h2>
      <p className="health-infra-subtitle">
        From <code>GET /api/v1/health/detailed</code>
        {payload.environment && (
          <>
            {" · environment: "}
            <code>{payload.environment}</code>
          </>
        )}
      </p>

      {hasDbData && (
        <section className="health-infra-section">
          <h3 className="health-infra-section-title">Database connection</h3>
          <InfoGrid
            entries={[
              ["Adapter", db.adapter],
              ["Database", db.database],
              ["Host", db.host],
              ["Port", db.port],
              ["Username", db.username],
              ["Encoding", db.encoding],
              ["Pool size", db.pool],
              ["Checkout timeout (s)", db.checkout_timeout],
              ["Reaping frequency (s)", db.reaping_frequency],
              ["Idle timeout (s)", db.idle_timeout],
            ]}
          />
        </section>
      )}

      {payload.server && (
        <section className="health-infra-section">
          <h3 className="health-infra-section-title">Server</h3>
          <InfoGrid
            entries={[
              ["Rails version", payload.server.rails_version],
              ["Ruby", payload.server.ruby],
              ["Puma workers", payload.server.puma_workers],
              ["Hostname", payload.server.hostname],
              ["PID", payload.server.pid],
            ]}
          />
        </section>
      )}

      {payload.endpoint && (
        <section className="health-infra-section">
          <h3 className="health-infra-section-title">Request endpoint</h3>
          <InfoGrid
            entries={[
              ["Scheme", payload.endpoint.scheme],
              ["Host", payload.endpoint.host],
              ["Port", payload.endpoint.port],
              ["Base URL", payload.endpoint.base_url],
              ["Path", payload.endpoint.path],
            ]}
          />
        </section>
      )}

      {payload.counts && (
        <section className="health-infra-section">
          <h3 className="health-infra-section-title">Record counts</h3>
          <InfoGrid
            entries={Object.entries(payload.counts).map(([k, v]) => [
              k.replace(/_/g, " "),
              v,
            ])}
          />
        </section>
      )}
    </div>
  );
}

interface HistoryEntry {
  at: string;
  passed: number;
  failed: number;
  avgLatency: number;
}

export default function ApiHealth() {
  const { user } = useAuth();
  const isAdminUser = user?.roles?.includes("admin");

  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const regularChecks = useMemo(
    () => API_CHECKS.filter((c) => !isWriteCheck(c)),
    []
  );
  const writeChecks = useMemo(() => API_CHECKS.filter(isWriteCheck), []);
  const grouped = useMemo(() => {
    const map: Record<string, ApiCheck[]> = {};
    regularChecks.forEach((check) => {
      if (!map[check.category]) map[check.category] = [];
      map[check.category].push(check);
    });
    return map;
  }, [regularChecks]);


  if (!isAdminUser) {
    return (
      <div className="page">
        <div className="admin-error">
          You do not have permission to view API health diagnostics.
        </div>
      </div>
    );
  }

  const getAuthToken = () => getApiToken();

  async function runSingle(check: ApiCheck) {
    setRunning((prev) => ({ ...prev, [check.id]: true }));
    try {
      const result = await runCheck(check, { getAuthToken });
      setResults((prev) => ({ ...prev, [check.id]: result }));
      return result;
    } finally {
      setRunning((prev) => ({ ...prev, [check.id]: false }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    try {
      const outs = await Promise.all(
        regularChecks.map((c) => runCheck(c, { getAuthToken }))
      );
      setResults((prev) => {
        const next = { ...prev };
        outs.forEach((r) => {
          next[r.id] = r;
        });
        return next;
      });
      const passed = outs.filter((r) => r.passed).length;
      const avgLatency = Math.round(
        outs.reduce((sum, r) => sum + (r.latencyMs || 0), 0) /
          Math.max(outs.length, 1)
      );
      setHistory((prev) =>
        [
          {
            at: new Date().toLocaleTimeString(),
            passed,
            failed: outs.length - passed,
            avgLatency,
          },
          ...prev,
        ].slice(0, 5)
      );
    } finally {
      setRunningAll(false);
    }
  }

  async function runWriteSingle(check: ApiCheck) {
    setRunning((prev) => ({ ...prev, [check.id]: true }));
    try {
      const result = await runWriteFlow(check, { getAuthToken });
      setResults((prev) => ({ ...prev, [check.id]: result }));
    } finally {
      setRunning((prev) => ({ ...prev, [check.id]: false }));
    }
  }

  function toggleCategory(name: string) {
    setOpenCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleInspector(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allResults = Object.values(results);
  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalFailed = allResults.filter((r) => !r.passed).length;


  const avgLatency = allResults.length
    ? Math.round(
        allResults.reduce((s, r) => s + (r.latencyMs || 0), 0) /
          allResults.length
      )
    : 0;

  const detailed = results["system-detailed"];
  const detailedPayload = detailed?.payload as
    | { version?: string }
    | undefined;
  const backendVersion = detailedPayload?.version;
  const versionMatched = backendVersion
    ? backendVersion === BACK_END_VERSION
    : null;

  return (
    <SettingsLayout
      title="API Health & Diagnostics"
      description={`${API_CHECKS.length} checks configured · backend ${BACK_END_VERSION}`}
      backTo="/settings"
      backLabel="Back to Settings"
    >
      <div className="health-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={runAll}
          disabled={runningAll}
        >
          {runningAll ? "Running…" : "Run All Checks"}
        </button>
      </div>

      {versionMatched != null && (
        <div
          className={`health-version-notice ${versionMatched ? "health-version-ok" : "health-version-warn"}`}
        >
          {versionMatched
            ? `✓ Version match: backend ${backendVersion}`
            : `⚠ Version mismatch: backend reports ${backendVersion} but frontend expects ${BACK_END_VERSION}`}
        </div>
      )}

      <InfrastructurePanel detailed={detailed} />

      {allResults.length > 0 && (
        <div className="health-summary-bar">
          <span className="health-summary-stat">
            <span className="health-summary-label">Passed</span>
            <span className="health-summary-value" style={{ color: "#137333" }}>
              {totalPassed}
            </span>
          </span>
          <span className="health-summary-stat">
            <span className="health-summary-label">Failed</span>
            <span className="health-summary-value" style={{ color: "#c5221f" }}>
              {totalFailed}
            </span>
          </span>
          <span className="health-summary-stat">
            <span className="health-summary-label">Avg Latency</span>
            <span className="health-summary-value">{avgLatency}ms</span>
          </span>
        </div>
      )}


      {Object.entries(grouped).map(([category, checks]) => {
        const open = openCategories[category] !== false;
        const passed = checks.filter((c) => results[c.id]?.passed).length;
        return (
          <section key={category} className="health-category">
            <button
              type="button"
              className="health-category-header"
              onClick={() => toggleCategory(category)}
            >
              <span>
                {category}
                {allResults.length > 0 && (
                  <span className="health-category-summary">
                    {" "}
                    · {passed}/{checks.length} passed
                  </span>
                )}
              </span>
              <span className="health-category-summary">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className="health-category-body">
                {checks.map((check) => {
                  const result = results[check.id];
                  const isRunning = running[check.id];
                  const isExpanded = expanded[check.id];
                  return (
                    <div key={check.id}>
                      <div className="health-row">
                        <span
                          className={`health-method-pill ${methodClass[check.method]}`}
                        >
                          {check.method}
                        </span>
                        <div className="health-row-meta">
                          <p className="health-row-name">{check.name}</p>
                          <div className="health-row-url">{check.url}</div>
                        </div>
                        <StatusBadge passed={result?.passed} />
                        {result && (
                          <span className="health-latency">
                            <span
                              className={`health-badge ${latencyClass(result.latencyRating)}`}
                            >
                              {result.latencyMs}ms
                            </span>
                            <span style={{ marginLeft: "0.4rem" }}>
                              {result.status}
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          className="admin-btn health-btn"
                          disabled={isRunning || runningAll}
                          onClick={() => runSingle(check)}
                        >
                          {isRunning ? "Testing…" : "Test"}
                        </button>
                        <button
                          type="button"
                          className="admin-btn health-btn"
                          onClick={() => toggleInspector(check.id)}
                        >
                          {isExpanded ? "Hide Details" : "Show Details"}
                        </button>
                      </div>
                      {isExpanded && (
                        <ResponseInspector check={check} result={result} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {writeChecks.map((check) => (
        <WriteSandbox
          key={check.id}
          check={check}
          result={results[check.id]}
          running={running[check.id]}
          onRun={() => runWriteSingle(check)}
        />
      ))}

      {history.length > 0 && (
        <div className="health-history">
          <h2 className="health-history-title">Run History (last 5)</h2>
          {history.map((h, i) => (
            <div key={i} className="health-history-row">
              <span>{h.at}</span>
              <span className="health-badge health-pass">
                {h.passed} passed
              </span>
              <span className="health-badge health-fail">
                {h.failed} failed
              </span>
              <span>avg {h.avgLatency}ms</span>
            </div>
          ))}
        </div>
      )}
    </SettingsLayout>
  );
}

