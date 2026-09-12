import { useEffect, useRef, useState } from "react";
import type { ApiCheck, CheckResult } from "../../../services/apiHealth/apiHealthConfig";

function JsonBlock({
  label,
  data,
  copyable = false,
}: {
  label: string;
  data: unknown;
  copyable?: boolean;
}) {
  let text: string;
  try {
    text = JSON.stringify(data, null, 2);
  } catch {
    text = String(data);
  }

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  function handleCopy() {
    navigator.clipboard
      .writeText(text)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"))
      .finally(() => {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopyState("idle"), 1500);
      });
  }

  return (
    <div className="health-inspector-section">
      {copyable ? (
        <div className="health-inspector-header">
          <div className="health-inspector-label">{label}</div>
          <button
            type="button"
            className={`health-copy-btn${copyState === "copied" ? " health-copy-btn-copied" : ""}`}
            onClick={handleCopy}
          >
            {copyState === "copied"
              ? "Copied ✓"
              : copyState === "failed"
                ? "Failed"
                : "Copy"}
          </button>
        </div>
      ) : (
        <div className="health-inspector-label">{label}</div>
      )}
      <pre className="health-inspector-code">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export default function ResponseInspector({
  check,
  result,
}: {
  check: ApiCheck;
  result: CheckResult | undefined;
}) {
  if (!check || !result) return null;

  const headers = result.requestHeaders || {};

  return (
    <div className="health-inspector">
      <JsonBlock
        label="Target Request"
        data={{ method: check.method, url: check.url }}
      />
      <JsonBlock label="Request Headers" data={headers} />
      <JsonBlock
        label="Response Meta"
        data={{ status: result.status, expectedStatus: result.expectedStatus }}
      />
      {result.error && (
        <JsonBlock
          label="Error"
          data={{ error: result.error, retried: result.retried }}
        />
      )}
      <JsonBlock label="Response Payload" data={result.payload ?? null} copyable />
    </div>
  );
}
