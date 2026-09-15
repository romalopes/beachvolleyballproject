/**
 * DrillDefinitionBuilder - the visual-mode content of the definition panel.
 *
 * The interactive court lives in a sticky pane beside (or above, on narrow
 * screens) the scrolling configuration: entity catalog, step list, per-step
 * controls. The raw JSON editor lives in the separate JSON mode of
 * DrillDefinitionPanel.
 */

import { useState } from "react";
import type { DrillDefinition, Location, Orientation } from "../../../drill/definition";
import { DEFAULT_ORIENTATION } from "../../../drill/definition";
import InteractiveCourt from "./InteractiveCourt";
import type { Layer } from "./InteractiveCourt";
import StepBuilder from "./StepBuilder";
import StepList from "./StepList";
import {
  EMPTY_DEFINITION,
  setEntityLocation,
  type EntityKind,
} from "./drill-model";
import type { SelectedEntity } from "./stepBuilderModel";

export interface DrillDefinitionBuilderProps {
  definition: DrillDefinition | null;
  onChange: (next: DrillDefinition) => void;
}

export default function DrillDefinitionBuilder({
  definition,
  onChange,
}: DrillDefinitionBuilderProps) {
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_ORIENTATION);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);

  const model = definition ?? EMPTY_DEFINITION;
  const stepIndex = Math.min(activeStepIndex, model.steps.length - 1);

  const handleMove = (
    kind: EntityKind,
    id: string,
    location: Location,
    layer: Layer,
  ) => {
    onChange(
      setEntityLocation(
        model,
        layer === "current" ? stepIndex : stepIndex + 1,
        kind,
        id,
        location,
      ),
    );
  };

  return (
    <div className="drill-definition-builder">
      <div className="drill-definition-builder-court-pane">
        <div className="drill-orientation-bar drill-definition-builder-orientation">
          <span className="drill-orientation-label">Orientation</span>
          <div
            className="drill-orientation-toggle"
            role="group"
            aria-label="Court orientation"
          >
            <button
              type="button"
              className={"drill-orientation-btn" + (orientation === "lateral" ? " active" : "")}
              aria-pressed={orientation === "lateral"}
              onClick={() => setOrientation("lateral")}
            >
              Lateral
            </button>
            <button
              type="button"
              className={"drill-orientation-btn" + (orientation === "top_down" ? " active" : "")}
              aria-pressed={orientation === "top_down"}
              onClick={() => setOrientation("top_down")}
            >
              Top down
            </button>
          </div>
        </div>
        <InteractiveCourt
          definition={model}
          orientation={orientation}
          stepIndex={stepIndex}
          selected={selected}
          onSelect={(kind, id) => setSelected({ kind, id })}
          onMove={handleMove}
          onCourtClick={() => setSelected(null)}
        />
      </div>

      <div className="drill-definition-builder-config-pane">
        <StepList
          definition={model}
          activeStepIndex={stepIndex}
          onSelectStep={setActiveStepIndex}
          onChange={onChange}
        />
        <StepBuilder
          definition={model}
          stepIndex={stepIndex}
          hasNext={stepIndex < model.steps.length - 1}
          selected={selected}
          onSelect={(kind, id) => setSelected({ kind, id })}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

