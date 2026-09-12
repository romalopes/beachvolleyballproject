import { useState } from "react";
import type {
  ApiCheck,
  CheckResult,
} from "../../../services/apiHealth/apiHealthConfig";
import ResponseInspector from "./ResponseInspector";

export default function WriteSandbox({
  check,
  onRun,
  result,
  running,
}: {
  check: ApiCheck;
  onRun: () => void;
  result: CheckResult | undefined;
  running: boolean | undefined;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="health-write-sandbox">
      <h3 className="health-write-title">Write Sandbox</h3>
      <p className="health-write-desc">
        {check.description ||
          "These requests modify data and are excluded from “Run All Checks”. They require explicit manual confirmation."}
      </p>

      <button
        type="button"
        className="admin-btn health-btn health-btn-danger"
        disabled={running}
        onClick={() => setConfirming(true)}
      >
        {running ? "Running…" : "Run Write Test"}
      </button>

      {result && (
        <div style={{ marginTop: "0.9rem" }}>
          <span className={`health-badge ${result.passed ? "health-pass" : "health-fail"}`}>
            {result.passed ? "PASS" : "FAIL"}
          </span>
          <span className="health-status-text" style={{ marginLeft: "0.5rem" }}>
            {result.error ||
              `Created + deleted temp category in ${result.latencyMs}ms`}
          </span>
          <div style={{ marginTop: "0.6rem" }}>
            <ResponseInspector check={check} result={result} />
          </div>
        </div>
      )}

      {confirming && (
        <div className="health-modal-backdrop">
          <div className="health-modal" role="dialog" aria-modal="true">
            <h4 style={{ marginTop: 0 }}>Confirm write test</h4>
            <p>
              This will create a temporary category and then immediately
              delete it. No other data is modified. Continue?
            </p>
            <div className="health-modal-actions">
              <button
                type="button"
                className="admin-btn health-btn"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn health-btn health-btn-danger"
                onClick={() => {
                  setConfirming(false);
                  onRun();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
