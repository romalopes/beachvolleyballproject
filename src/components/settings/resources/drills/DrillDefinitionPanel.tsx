/**
 * DrillDefinitionPanel — the unified definition region.
 *
 * Two views of one model, chosen with a segmented toggle:
 *
 * - **Visual builder** — the entity catalog, the interactive court and the
 *   per-step controls, with a read-only JSON preview underneath so the JSON is
 *   visible *while* the drill is being drawn.
 * - **JSON editor** — the raw textarea, for pasting or hand-editing a
 *   definition.
 *
 * The panel owns no definition state of its own. `DrillForm` is the single
 * source of truth: a visual edit goes through `onDefinitionChange` (which
 * re-derives the JSON text from the model) and a manual edit goes through
 * `onJsonTextChange` (which re-parses and normalises the model). That is why
 * the preview renders `jsonText` itself rather than a copy — it is literally
 * the text the form will submit.
 */

import { useState } from "react";
import type { DrillDefinition } from "../../../drill/definition";
import type { DrillSchemaIssue } from "../../../../services/drillSchema";
import { EMPTY_DEFINITION } from "./drill-model";
import DrillDefinitionBuilder from "./DrillDefinitionBuilder";
import DrillDefinitionEditor from "./DrillDefinitionEditor";
import EntityCatalog from "./EntityCatalog";

export interface DrillDefinitionPanelProps {
  definition: DrillDefinition | null;
  /** Visual edit: the form derives the JSON text from the new model. */
  onDefinitionChange: (next: DrillDefinition) => void;
  /** The JSON the form will submit — also the visual mode's live preview. */
  jsonText: string;
  /** Manual edit: the form re-parses the text back into the model. */
  onJsonTextChange: (text: string) => void;
  /** JSON.parse failure for the current text, if any. */
  parseError: string | null;
  /** Schema issues for the current text, if any. */
  issues: DrillSchemaIssue[];
  onFormat: () => void;
  /** True for an existing drill whose stored definition is not renderable. */
  storedDefinitionMissing: boolean;
}

const VISUAL_MODE = "visual";
const JSON_MODE = "json";

export default function DrillDefinitionPanel({
  definition,
  onDefinitionChange,
  jsonText,
  onJsonTextChange,
  parseError,
  issues,
  onFormat,
  storedDefinitionMissing,
}: DrillDefinitionPanelProps) {
  const [mode, setMode] = useState<typeof VISUAL_MODE | typeof JSON_MODE>(
    VISUAL_MODE,
  );

  return (
    <div className="drill-definition-panel">
      <div
        className="drill-definition-panel-toggle"
        role="group"
        aria-label="Definition editor mode"
      >
        <button
          type="button"
          className={
            "drill-definition-panel-tab" +
            (mode === VISUAL_MODE ? " active" : "")
          }
          aria-pressed={mode === VISUAL_MODE}
          onClick={() => setMode(VISUAL_MODE)}
        >
          Visual builder
        </button>
        <button
          type="button"
          className={
            "drill-definition-panel-tab" + (mode === JSON_MODE ? " active" : "")
          }
          aria-pressed={mode === JSON_MODE}
          onClick={() => setMode(JSON_MODE)}
        >
          JSON editor
        </button>
      </div>

      <div className="drill-definition-panel-content">
        {mode === VISUAL_MODE ? (
          <>
            <EntityCatalog
              definition={definition ?? EMPTY_DEFINITION}
              onChange={onDefinitionChange}
            />
            <DrillDefinitionBuilder
              definition={definition}
              onChange={onDefinitionChange}
            />
            <details className="drill-json-preview">
              <summary className="drill-json-preview-toggle">
                JSON preview (what will be saved)
              </summary>
              <pre
                className="drill-json-preview-code"
                data-testid="json-preview"
              >
                {jsonText}
              </pre>
            </details>
          </>
        ) : (
          <DrillDefinitionEditor
            value={jsonText}
            onChange={onJsonTextChange}
            parseError={parseError}
            issues={issues}
            onFormat={onFormat}
          />
        )}
      </div>

      {storedDefinitionMissing && (
        <p className="drill-notice" role="note">
          This drill has no saved definition yet. The builder below shows an
          empty draft, and that draft is what the JSON will contain when you
          save.
        </p>
      )}
    </div>
  );
}


