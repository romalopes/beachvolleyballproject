/**
 * DrillDefinitionEditor — JSON textarea for a drill's `definition` column.
 *
 * Purely presentational: parsing and schema validation happen in
 * `services/drillSchema/parse.ts`, invoked by DrillForm. This component only
 * renders the text, the derived feedback, and the format action.
 */

import {
  formatIssue,
  type DrillSchemaIssue,
} from "../../../../services/drillSchema";
import { useLineNumberGutter } from "../../../../components/useLineNumberGutter";

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
  // The gutter's mechanics are shared with the read-only JSON views
  // (`LineNumberedCode`); `wrap="off"` on the textarea below is what keeps one
  // number per visual line.
  const { gutterRef, scrollerRef, onScroll, numbers } =
    useLineNumberGutter<HTMLTextAreaElement>(value);
  const hasIssues = !parseError && issues.length > 0;
  const isEmpty = value.trim() === "";

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
          {numbers}
        </div>
        <textarea
          ref={scrollerRef}
          id="drill-definition"
          className="drill-definition-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onScroll}
          rows={6}
          wrap="off"
          spellCheck={false}
          aria-invalid={Boolean(parseError) || hasIssues}
          aria-describedby="drill-definition-feedback"
          placeholder={'{ "version": 1, "side": { "grid": { "columns": 5, "rows": 4 } } }'}
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
