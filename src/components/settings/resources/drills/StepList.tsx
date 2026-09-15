/**
 * StepList — the step manager of the visual builder.
 *
 * A controlled list of the drill's steps: select one to edit it in the
 * `StepBuilder`, add / duplicate / remove / reorder. All edits go through the
 * pure helpers in `drill-model.ts` and are emitted as a whole new
 * `DrillDefinition`, exactly like `EntityCatalog` does.
 */

import type { DrillDefinition } from "../../../drill/definition";
import {
  addStep,
  duplicateStep,
  moveStep,
  removeStep,
} from "./drill-model";

export interface StepListProps {
  definition: DrillDefinition;
  /** Index of the step currently open in the `StepBuilder`. */
  activeStepIndex: number;
  onSelectStep: (index: number) => void;
  onChange: (next: DrillDefinition) => void;
}

export default function StepList({
  definition,
  activeStepIndex,
  onSelectStep,
  onChange,
}: StepListProps) {
  return (
    <div className="drill-step-list" role="group" aria-label="Steps">
      <ul className="drill-step-list-items">
        {definition.steps.map((step, index) => {
          const isActive = index === activeStepIndex;
          const placed =
            step.participants.length +
            step.balls.length +
            step.objects.length;
          return (
            <li
              key={step.id}
              className={`drill-step-list-item${isActive ? " drill-step-list-item-active" : ""}`}
            >
              <button
                type="button"
                className="drill-step-list-select"
                onClick={() => onSelectStep(index)}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="drill-step-list-id">{step.id}</span>
                <span className="drill-step-list-meta">
                  {step.description ? step.description : `${placed} placed`}
                </span>
              </button>
              <span className="drill-step-list-actions">
                <button
                  type="button"
                  aria-label={`Move ${step.id} up`}
                  disabled={index === 0}
                  onClick={() => onChange(moveStep(definition, index, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${step.id} down`}
                  disabled={index === definition.steps.length - 1}
                  onClick={() => onChange(moveStep(definition, index, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate ${step.id}`}
                  onClick={() => onChange(duplicateStep(definition, index))}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${step.id}`}
                  disabled={definition.steps.length <= 1}
                  onClick={() => {
                    onChange(removeStep(definition, index));
                    if (isActive && activeStepIndex >= definition.steps.length - 1) {
                      onSelectStep(Math.max(0, activeStepIndex - 1));
                    }
                  }}
                >
                  Remove
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="admin-btn admin-btn-add drill-step-list-add"
        onClick={() => onChange(addStep(definition))}
      >
        Add step
      </button>
    </div>
  );
}