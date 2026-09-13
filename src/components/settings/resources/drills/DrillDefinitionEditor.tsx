/**
 * DrillDefinitionEditor — JSON textarea for a drill's `definition` column.
 *
 * Purely presentational: parsing and schema validation happen in
 * `services/drillSchema/parse.ts`, invoked by DrillForm. This component only
 * renders the text, the derived feedback, and the format action.
 */

import { useEffect, useRef, type UIEvent } from "react";
import {
  formatIssue,
  type DrillSchemaIssue,
} from "../../../../services/drillSchema";

interface DrillDefinitionEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** JSON.parse failure message, shown instead of schema issues. */
  parseError: string | null;
  /** Structural issues from the shared v1 schema. */
  issues: DrillSchemaIssue[];
  onFormat: () => void;
}

export default function DrillDefinitionEditor({
  value,
  onChange,
  parseError,
  issues,
  onFormat,
}: DrillDefinitionEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasIssues = !parseError && issues.length > 0;
  const isEmpty = value.trim() === "";

  // One gutter row per logical line. wrap="off" on the textarea keeps logical
  // and visual lines identical, so the numbers stay aligned with the text.
  const lineCount = value === "" ? 1 : value.split("\n").length;

  // Mirror the textarea's vertical scroll onto the (overflow: hidden) gutter.
  const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Keep the gutter exactly as tall as the textarea, including when the user
  // drags the native resize handle. (jsdom has no ResizeObserver; the guard
  // keeps tests running — the CSS flex stretch is the fallback there.)
  useEffect(() => {
    const textarea = textareaRef.current;
    const gutter = gutterRef.current;
    if (!textarea || !gutter || typeof ResizeObserver === "undefined") return;

    const syncHeight = () => {
      gutter.style.height = `${textarea.clientHeight}px`;
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="admin-field drill-definition-field">
      <label htmlFor="drill-definition">Definition (JSON)</label>
      <p className="drill-definition-hint">
        Optional. Paste a v1 drill definition to visualise this drill. Leave
        blank to store no definition.
      </p>

      <div className="drill-definition-editor-wrap">
        <div
          ref={gutterRef}
          className="drill-definition-gutter"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
        </div>
        <textarea
          ref={textareaRef}
          id="drill-definition"
          className="drill-definition-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          rows={6}
          wrap="off"
          spellCheck={false}
          aria-invalid={Boolean(parseError) || hasIssues}
          aria-describedby="drill-definition-feedback"
          placeholder={'{ "version": 1, "court": { "grid": { "columns": 5, "rows": 4 } } }'}
        />
      </div>

      <div className="drill-definition-toolbar">
        <button
          type="button"
          className="admin-btn"
          onClick={onFormat}
          disabled={isEmpty}
        >
          Format JSON
        </button>
      </div>

      <div id="drill-definition-feedback" aria-live="polite">
        {parseError && (
          <ul className="drill-definition-issues">
            <li className="drill-definition-issue drill-definition-issue-parse">
              Invalid JSON: {parseError}
            </li>
          </ul>
        )}

        {hasIssues && (
          <ul className="drill-definition-issues">
            {issues.map((issue, index) => (
              <li
                key={`${issue.keyword}-${issue.instancePath}-${index}`}
                className={`drill-definition-issue drill-definition-issue-${issue.keyword}`}
              >
                {formatIssue(issue)}
              </li>
            ))}
          </ul>
        )}

        {!parseError && !hasIssues && !isEmpty && (
          <p className="drill-definition-ok">
            Definition satisfies the v1 schema.
          </p>
        )}
      </div>
    </div>
  );
}
