/**
 * AnnotationEditor — the per-step text annotation properties panel.
 *
 * Shown in the config pane when a Text element is selected in the visual
 * builder: multi-line text, formatting (size, bold, italic, alignment),
 * optional background/border, size sliders, court side and delete.
 *
 * The anchor is a logical `Location` (side + grid x/y) — the same coordinate
 * system as a player placement — so the panel can move the text between sides
 * without inventing a second coordinate system.
 */
import type { Location, TextAnnotation } from "../../../drill/definition";
import { TEXT_ALIGNMENTS } from "../../../drill/definition";
import type { DrillDefinition } from "../../../drill/definition";
import { updateStepAnnotation } from "./drill-model";

export interface AnnotationEditorProps {
  definition: DrillDefinition;
  stepIndex: number;
  annotationId: string;
  onChange: (next: DrillDefinition) => void;
  onDelete: () => void;
}

export default function AnnotationEditor({
  definition,
  stepIndex,
  annotationId,
  onChange,
  onDelete,
}: AnnotationEditorProps) {
  const annotation: TextAnnotation | undefined = definition.steps[
    stepIndex
  ]?.annotations?.find((a) => a.id === annotationId);
  if (!annotation) return null;

  const patch = (partial: Partial<TextAnnotation>) => {
    onChange(updateStepAnnotation(definition, stepIndex, annotationId, partial));
  };

  return (
    <fieldset className="drill-annotation-editor">
      <legend>Text</legend>

      <label>
        Text
        <textarea
          rows={3}
          value={annotation.text}
          onChange={(e) => patch({ text: e.target.value })}
          aria-label="Annotation text"
        />
      </label>

      <div className="drill-annotation-editor-row">
        <label>
          Font size
          <input
            type="number"
            min={6}
            max={64}
            value={annotation.font_size ?? 14}
            aria-label="Annotation font size"
            onChange={(e) => patch({ font_size: Number(e.target.value) })}
          />
        </label>
        <label>
          Width
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={annotation.width}
            aria-label="Annotation width"
            onChange={(e) => patch({ width: Number(e.target.value) })}
          />
        </label>
        <label>
          Height
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={annotation.height}
            aria-label="Annotation height"
            onChange={(e) => patch({ height: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="drill-annotation-editor-row">
        <label>
          <input
            type="checkbox"
            checked={Boolean(annotation.bold)}
            aria-label="Annotation bold"
            onChange={(e) => patch({ bold: e.target.checked })}
          />
          Bold
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(annotation.italic)}
            aria-label="Annotation italic"
            onChange={(e) => patch({ italic: e.target.checked })}
          />
          Italic
        </label>
        <label>
          Court side
          <select
            value={annotation.location.side}
            aria-label="Annotation court side"
            onChange={(e) =>
              patch({
                location: {
                  ...annotation.location,
                  side: e.target.value as Location["side"],
                },
              })
            }
          >
            <option value="side_1">Side 1</option>
            <option value="side_2">Side 2</option>
          </select>
        </label>
        <label>
          Alignment
          <select
            value={annotation.align ?? "left"}
            aria-label="Annotation alignment"
            onChange={(e) =>
              patch({ align: e.target.value as TextAnnotation["align"] })
            }
          >
            {TEXT_ALIGNMENTS.map((align) => (
              <option key={align} value={align}>
                {align}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="drill-annotation-editor-row">
        <label>
          <input
            type="checkbox"
            checked={Boolean(annotation.background)}
            aria-label="Annotation background"
            onChange={(e) => patch({ background: e.target.checked })}
          />
          Background
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(annotation.border)}
            aria-label="Annotation border"
            onChange={(e) => patch({ border: e.target.checked })}
          />
          Border
        </label>
      </div>

      <button
        type="button"
        className="admin-btn admin-btn-remove"
        onClick={onDelete}
      >
        Delete text
      </button>
    </fieldset>
  );
}