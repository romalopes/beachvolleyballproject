/**
 * DrillDefinitionBuilder - the visual-mode content of the definition panel.
 *
 * The interactive court lives in a sticky pane beside (or above, on narrow
 * screens) the scrolling configuration: entity catalog, step list, per-step
 * controls. The raw JSON editor lives in the separate JSON mode of
 * DrillDefinitionPanel.
 *
 * The court pane also carries the visualisation controls — orientation, the
 * side size slider and `DrillStepControls` — so an author can play the drill
 * and check the moves without leaving the editor. Playback reuses the viewer's
 * state machine (`useStepPlayback`) and interpolation rule, so what is checked
 * here is exactly what the finished drill will do.
 */

import { useState } from "react";
import type { DrillDefinition, Location, Orientation } from "../../../drill/definition";
import { DEFAULT_ORIENTATION } from "../../../drill/definition";
import { STEP_DURATION_MS } from "../../../drill/playback";
import { useStepPlayback } from "../../../drill/useStepPlayback";
import DrillStepControls from "../../../drill/DrillStepControls";
import CourtSetup from "./CourtSetup";
import InteractiveCourt from "./InteractiveCourt";
import type { Layer } from "./InteractiveCourt";
import StepBuilder from "./StepBuilder";
import StepList from "./StepList";
import {
  EMPTY_DEFINITION,
  setEntityLocation,
  setMovementTarget,
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
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);
  // Side display size: percentage of the pane width; height follows the fixed
  // aspect ratio, so one slider scales the whole court. Purely visual.
  const [sideScale, setSideScale] = useState(100);

  const model = definition ?? EMPTY_DEFINITION;
  // The preview toggle starts at the saved default (`view.orientation`) and
  // never writes back to it — it is only the orientation the author previews
  // in. The saved default itself is edited in CourtSetup.
  const previewOrientation = orientation ?? model.view?.orientation ?? DEFAULT_ORIENTATION;
  const stepIndex = Math.min(activeStepIndex, model.steps.length - 1);

  /**
   * Selecting a step is shared by the step list and the timeline: it moves the
   * edit cursor and drops the entity selection, which belongs to the old step.
   */
  const selectStep = (index: number) => {
    setActiveStepIndex(index);
    setSelected(null);
  };

  /**
   * Playback state machine, shared with the viewer (`useStepPlayback`). The
   * builder's step index IS the edit cursor, so checking the moves walks the
   * same steps the author is editing.
   */
  const playback = useStepPlayback({
    stepIndex,
    stepCount: model.steps.length,
    stepDurationMs: STEP_DURATION_MS,
    onStepChange: selectStep,
  });

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

  /** An authored last-step exit target was dragged. */
  const handleTargetMove = (
    kind: EntityKind,
    movementIndex: number,
    location: Location,
  ) => {
    onChange(setMovementTarget(model, stepIndex, kind, movementIndex, location));
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
              className={"drill-orientation-btn" + (previewOrientation === "lateral" ? " active" : "")}
              aria-pressed={previewOrientation === "lateral"}
              onClick={() => setOrientation("lateral")}
            >
              Lateral
            </button>
            <button
              type="button"
              className={"drill-orientation-btn" + (previewOrientation === "top_down" ? " active" : "")}
              aria-pressed={previewOrientation === "top_down"}
              onClick={() => setOrientation("top_down")}
            >
              Top down
            </button>
          </div>
          <div className="drill-size-control">
            <label
              className="drill-orientation-label"
              htmlFor="drill-builder-size-range"
            >
              Size
            </label>
            <input
              id="drill-builder-size-range"
              type="range"
              className="drill-size-range"
              min={50}
              max={150}
              step={5}
              value={sideScale}
              aria-label="Court size"
              onChange={(event) => setSideScale(Number(event.target.value))}
            />
            <span className="drill-speed-value">{sideScale}%</span>
          </div>
        </div>
        <InteractiveCourt
          definition={model}
          orientation={previewOrientation}
          stepIndex={stepIndex}
          selected={selected}
          onSelect={(kind, id) => setSelected({ kind, id })}
          onMove={handleMove}
          onTargetMove={handleTargetMove}
          onCourtClick={() => setSelected(null)}
          playing={playback.playing}
          progress={playback.progress}
          sizeScale={sideScale}
        />
        <DrillStepControls
          stepIndex={stepIndex}
          stepCount={model.steps.length}
          playing={playback.playing}
          onPrev={playback.prev}
          onNext={playback.next}
          playMode={playback.playMode}
          onTogglePlay={playback.togglePlay}
          onPlayStep={playback.playStep}
          onSelect={playback.select}
        />
      </div>

      <div className="drill-definition-builder-config-pane">
        <CourtSetup definition={model} onChange={onChange} />
        <StepList
          definition={model}
          activeStepIndex={stepIndex}
          onSelectStep={selectStep}
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

