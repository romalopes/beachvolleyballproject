/**
 * DrillViewer — coordinates step state, side rendering, actions, animation
 * and playback. Playback (the speed-aware RAF loop) and the per-entity frame
 * interpolation live in the shared `useStepPlayback` / `playback` modules, so
 * the editor's visualisation animates identically. Owns the orientation toggle
 * (a viewer concern; definitions no longer carry orientation). Contains no side
 * geometry calculations.
 */

import { useMemo, useState } from "react";
import type {
  DrillDefinition,
  EntityState,
  Location,
  Movement,
  Orientation,
  Step,
} from "./definition";
import { DEFAULT_ORIENTATION } from "./definition";
import { buildSideGeometry, locationToSvg } from "./geometry";
import DrillSide from "./DrillSide";
import Participant from "./Participant";
import Ball from "./Ball";
import DrillObject from "./DrillObject";
import MovementArrow from "./MovementArrow";
import DrillStepControls from "./DrillStepControls";
import DrillLegend from "./DrillLegend";
import {
  entityFramePoint,
  statesKeyFor,
  STEP_DURATION_MS,
  type MoveKey,
} from "./playback";
import { useStepPlayback } from "./useStepPlayback";

interface Overlay {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

export default function DrillViewer({
  definition,
}: {
  definition: DrillDefinition;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Orientation is a viewer concern: defaults to "lateral", toggled by the user.
  const [orientation, setOrientation] = useState<Orientation>(
    definition.view?.orientation ?? DEFAULT_ORIENTATION,
  );
  // Speed is a viewer concern too: multiplier applied to the base step duration.
  const [speed, setSpeed] = useState(1);
  // Side display size: percentage of the container width; height follows the
  // fixed aspect ratio, so one slider scales the whole side. Purely visual.
  const [sideScale, setSideScale] = useState(100);

  const geometry = useMemo(
    () => buildSideGeometry(orientation, definition.side),
    [definition, orientation],
  );

  /** Base step duration divided by the speed multiplier. */
  const stepDurationMs = STEP_DURATION_MS / speed;

  const steps: Step[] = definition.steps ?? [];
  const step = steps[stepIndex];
  const nextStep = steps[stepIndex + 1];

  const entityMap = useMemo(() => {
    const byId = <T extends { id: string }>(list: T[]) =>
      Object.fromEntries(list.map((e) => [e.id, e]));
    return {
      participants: byId(definition.participants),
      balls: byId(definition.balls),
      objects: byId(definition.objects),
    };
  }, [definition]);

  /**
   * Playback state machine, shared with the editor's visualisation via
   * `useStepPlayback`. The viewer owns the step cursor; the hook owns
   * `playing`/`playMode`/`progress` and the speed-aware RAF loop.
   */
  const playback = useStepPlayback({
    stepIndex,
    stepCount: steps.length,
    stepDurationMs,
    onStepChange: setStepIndex,
  });
  const { playing, progress } = playback;

  if (!definition || !step) return null;

  /** `Location` → SVG point for the current geometry. */
  const svg = (loc: Location) => locationToSvg(loc, geometry);

  const renderEntities = (
    states: EntityState[],
    nextStates: EntityState[] | undefined,
    movements: Movement[] | undefined,
    key: MoveKey,
  ) =>
    states.map((s) => {
      if (!s.active || !s.location) return null;
      const point = entityFramePoint({
        states,
        nextStates,
        movements,
        key,
        id: s.id,
        progress,
        playing,
        toSvg: svg,
      });
      if (!point) return null;
      const { x, y } = point;
      const meta = entityMap[statesKeyFor(key)][s.id];
      const actions = step.actions
        .filter((a) => a.participant_id === s.id)
        .map((a) => a.action.type);
      const tooltip: Overlay = {
        x,
        y,
        title: `${s.id}${meta ? ` — ${meta.type}` : ""}`,
        lines: [
          meta && "role" in meta && meta.role ? `Role: ${meta.role}` : "",
          meta?.description ?? "",
          actions.length ? `Actions: ${actions.join(", ")}` : "",
          `Pos: ${s.location.side} (${s.location.x.toFixed(2)}, ${s.location.y.toFixed(2)})`,
        ].filter(Boolean),
      };
      const handlers = {
        onMouseEnter: () => setOverlay(tooltip),
        onMouseLeave: () => setOverlay(null),
        onClick: () =>
          setOverlay((o) => (o?.title === tooltip.title ? null : tooltip)),
      };
      const titleText = tooltip.lines.join(" · ");

      if (key === "participant_id") {
        const p = entityMap.participants[s.id];
        return (
          <Participant
            key={s.id}
            id={s.id}
            type={p?.type ?? "player"}
            x={x}
            y={y}
            title={titleText}
            {...handlers}
          />
        );
      }
      if (key === "ball_id") {
        return (
          <Ball
            key={s.id}
            id={s.id}
            x={x}
            y={y}
            title={titleText}
            {...handlers}
          />
        );
      }
      return (
        <DrillObject
          key={s.id}
          type={entityMap.objects[s.id]?.type ?? "custom"}
          x={x}
          y={y}
          title={titleText}
          {...handlers}
        />
      );
    });
  const renderMovements = (
    movements: Movement[] | undefined,
    kind: "participant" | "ball" | "object",
    key: MoveKey,
  ) =>
    (movements ?? []).map((m, i) => {
      const from =
        m.from ??
        step[statesKeyFor(key)].find((s) => s.id === m[key])?.location;
      if (!from) return null;
      const f = svg(from);
      const t = svg(m.to);
      return (
        <MovementArrow
          key={`${m[key]}-${i}`}
          from={f}
          to={t}
          kind={kind}
          title={m.description}
        />
      );
    });

  return (
    <div className="drill-viewer">
      {definition.description && (
        <p className="drill-definition-description">{definition.description}</p>
      )}
      <DrillLegend definition={definition} />
      <div className="drill-orientation-bar">
        <span className="drill-orientation-label">Orientation</span>
        <div
          className="drill-orientation-toggle"
          role="group"
          aria-label="Side orientation"
        >
          <button
            type="button"
            className={`drill-orientation-btn${orientation === "lateral" ? " active" : ""}`}
            aria-pressed={orientation === "lateral"}
            onClick={() => setOrientation("lateral")}
          >
            Lateral
          </button>
          <button
            type="button"
            className={`drill-orientation-btn${orientation === "top_down" ? " active" : ""}`}
            aria-pressed={orientation === "top_down"}
            onClick={() => setOrientation("top_down")}
          >
            Top down
          </button>
        </div>
        <div className="drill-size-control">
          <label className="drill-orientation-label" htmlFor="drill-size-range">
            Size
          </label>
          <input
            id="drill-size-range"
            type="range"
            className="drill-size-range"
            min={50}
            max={150}
            step={5}
            value={sideScale}
            aria-label="Side size"
            onChange={(e) => setSideScale(Number(e.target.value))}
          />
          <span className="drill-speed-value">{sideScale}%</span>
        </div>
        <div className="drill-speed-control">
          <label
            className="drill-orientation-label"
            htmlFor="drill-speed-range"
          >
            Speed
          </label>
          <input
            id="drill-speed-range"
            type="range"
            className="drill-speed-range"
            min={0.25}
            max={3}
            step={0.25}
            value={speed}
            aria-label="Movement speed"
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span className="drill-speed-value">{speed}×</span>
        </div>
      </div>

      <div
        className="drill-canvas"
        data-orientation={orientation}
        style={{
          width: `${sideScale}%`,
          // The CSS top_down cap scales with the slider (100% → 540px).
          maxWidth:
            orientation === "top_down"
              ? `${Math.round(540 * (sideScale / 100))}px`
              : undefined,
        }}
      >
        <DrillSide orientation={orientation} side={definition.side} />

        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="drill-entities-svg"
        >
          {renderMovements(
            step.participant_movements,
            "participant",
            "participant_id",
          )}
          {renderMovements(step.ball_movements, "ball", "ball_id")}
          {renderMovements(step.object_movements, "object", "object_id")}
          {renderEntities(
            step.objects,
            nextStep?.objects,
            step.object_movements,
            "object_id",
          )}
          {renderEntities(
            step.participants,
            nextStep?.participants,
            step.participant_movements,
            "participant_id",
          )}
          {renderEntities(
            step.balls,
            nextStep?.balls,
            step.ball_movements,
            "ball_id",
          )}
        </svg>
      </div>

      {overlay && (
        <div
          className="drill-tooltip"
          style={{
            left: `${(overlay.x / geometry.width) * 100}%`,
            top: `${(overlay.y / geometry.height) * 100}%`,
          }}
        >
          <strong>{overlay.title}</strong>
          {overlay.lines.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}

      <DrillStepControls
        stepIndex={stepIndex}
        stepCount={steps.length}
        playing={playback.playing}
        onPrev={playback.prev}
        onNext={playback.next}
        playMode={playback.playMode}
        onTogglePlay={playback.togglePlay}
        onPlayStep={playback.playStep}
        onSelect={playback.select}
      />
      {step.description && (
        <p className="drill-step-description">{step.description}</p>
      )}

      {step.actions.length > 0 && (
        <ul className="drill-actions">
          {step.actions.map((a, i) => (
            <li key={i}>
              <span className={`tag tag-${a.action.type}`}>
                {a.action.type}
              </span>{" "}
              <strong>{a.participant_id}</strong>
              {a.action.description ? ` — ${a.action.description}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
