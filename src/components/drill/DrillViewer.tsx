/**
 * DrillViewer — coordinates step state, court rendering, actions, animation
 * and playback. Owns the orientation toggle (a viewer concern; definitions
 * no longer carry orientation). Contains no court geometry calculations.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DrillDefinition,
  EntityState,
  Location,
  Movement,
  Orientation,
  Step,
} from "./definition";
import { DEFAULT_ORIENTATION } from "./definition";
import { buildCourtGeometry, locationToSvg } from "./geometry";
import DrillCourt from "./DrillCourt";
import Participant from "./Participant";
import Ball from "./Ball";
import DrillObject from "./DrillObject";
import MovementArrow from "./MovementArrow";
import DrillStepControls from "./DrillStepControls";
import DrillLegend from "./DrillLegend";

const STEP_DURATION_MS = 1500;

interface Overlay {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

type StateKey = "participants" | "balls" | "objects";
type MoveKey = "participant_id" | "ball_id" | "object_id";

export default function DrillViewer({
  definition,
}: {
  definition: DrillDefinition;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"all" | "step">("all");
  const [progress, setProgress] = useState(0); // 0..1 within current step
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Orientation is a viewer concern: defaults to "lateral", toggled by the user.
  const [orientation, setOrientation] =
    useState<Orientation>(DEFAULT_ORIENTATION);
  // Speed is a viewer concern too: multiplier applied to the base step duration.
  const [speed, setSpeed] = useState(1);
  // Court display size: percentage of the container width; height follows the
  // fixed aspect ratio, so one slider scales the whole court. Purely visual.
  const [courtScale, setCourtScale] = useState(100);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  // Progress is mirrored in a ref so the RAF loop accumulates deltas without
  // stale closures — that is what lets the speed slider change mid-playback.
  const progressRef = useRef(0);

  const geometry = useMemo(
    () => buildCourtGeometry(orientation, definition.court),
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

  /** Start playback in the given mode, always replaying the current step from 0. */
  const startPlay = (mode: "all" | "step") => {
    setPlayMode(mode);
    lastTickRef.current = null;
    progressRef.current = 0;
    setProgress(0);
    setPlaying(true);
  };

  // requestAnimationFrame loop while playing. Progress accumulates elapsed
  // time divided by the speed-adjusted step duration, so changing the speed
  // mid-playback takes effect smoothly from the next frame.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = (t: number) => {
      const dt = lastTickRef.current === null ? 0 : t - lastTickRef.current;
      lastTickRef.current = t;
      const p = Math.min(1, progressRef.current + dt / stepDurationMs);
      progressRef.current = p;
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (playMode === "all" && stepIndex < steps.length - 1) {
        lastTickRef.current = t;
        progressRef.current = 0;
        setProgress(0);
        setStepIndex((i) => i + 1);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, playMode, stepIndex, steps.length, stepDurationMs]);

  if (!definition || !step) return null;

  const statesKey = (key: MoveKey): StateKey =>
    key === "participant_id"
      ? "participants"
      : key === "ball_id"
        ? "balls"
        : "objects";

  /** SVG point for an entity at the current animation frame.
   *
   * At rest (paused or progress 0) this is exactly the current step state's
   * location. While playing it interpolates movement.from → movement.to,
   * converting each endpoint through locationToSvg() with its OWN court
   * first and then lerping the SVG pixels. A Location cannot represent
   * "between courts", so cross-court flights must interpolate in SVG space —
   * pinning the whole trajectory to the target court flattens the launch
   * point into the wrong court.
   */
  const framePoint = (
    states: EntityState[],
    nextStates: EntityState[] | undefined,
    movements: Movement[] | undefined,
    key: MoveKey,
    id: string,
  ): { x: number; y: number } | null => {
    const current = states.find((s) => s.id === id && s.active);
    if (!current?.location) return null;
    const movement = movements?.find((m) => m[key] === id);
    if (!movement || !playing || progress === 0) return svg(current.location);
    const fromLoc = movement.from ?? current.location;
    const toLoc =
      movement.to ??
      nextStates?.find((s) => s.id === id && s.active)?.location ??
      current.location;
    const fromSvg = svg(fromLoc);
    const toSvg = svg(toLoc);
    return {
      x: fromSvg.x + (toSvg.x - fromSvg.x) * progress,
      y: fromSvg.y + (toSvg.y - fromSvg.y) * progress,
    };
  };

  const svg = (loc: Location) => locationToSvg(loc, geometry);

  const renderEntities = (
    states: EntityState[],
    nextStates: EntityState[] | undefined,
    movements: Movement[] | undefined,
    key: MoveKey,
  ) =>
    states.map((s) => {
      if (!s.active || !s.location) return null;
      const point = framePoint(states, nextStates, movements, key, s.id);
      if (!point) return null;
      const { x, y } = point;
      const meta = entityMap[statesKey(key)][s.id];
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
          `Pos: ${s.location.court} (${s.location.x.toFixed(2)}, ${s.location.y.toFixed(2)})`,
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
        m.from ?? step[statesKey(key)].find((s) => s.id === m[key])?.location;
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
      <DrillLegend definition={definition} />
      <div className="drill-orientation-bar">
        <span className="drill-orientation-label">Orientation</span>
        <div
          className="drill-orientation-toggle"
          role="group"
          aria-label="Court orientation"
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
            value={courtScale}
            aria-label="Court size"
            onChange={(e) => setCourtScale(Number(e.target.value))}
          />
          <span className="drill-speed-value">{courtScale}%</span>
        </div>
        <div className="drill-speed-control">
          <label className="drill-orientation-label" htmlFor="drill-speed-range">
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
          width: `${courtScale}%`,
          // The CSS top_down cap scales with the slider (100% → 540px).
          maxWidth:
            orientation === "top_down"
              ? `${Math.round(540 * (courtScale / 100))}px`
              : undefined,
        }}
      >
        <DrillCourt orientation={orientation} court={definition.court} />

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
        playing={playing}
        onPrev={() => {
          setPlaying(false);
          lastTickRef.current = null;
          progressRef.current = 0;
          setProgress(0);
          setStepIndex((i) => Math.max(0, i - 1));
        }}
        onNext={() => {
          setPlaying(false);
          lastTickRef.current = null;
          progressRef.current = 0;
          setProgress(0);
          setStepIndex((i) => Math.min(steps.length - 1, i + 1));
        }}
        playMode={playMode}
        onTogglePlay={() => (playing ? setPlaying(false) : startPlay("all"))}
        onPlayStep={() =>
          playing && playMode === "step" ? setPlaying(false) : startPlay("step")
        }
        onSelect={(i) => {
          setPlaying(false);
          lastTickRef.current = null;
          progressRef.current = 0;
          setProgress(0);
          setStepIndex(i);
        }}
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
