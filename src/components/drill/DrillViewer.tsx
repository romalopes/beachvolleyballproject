/**
 * DrillViewer — coordinates step state, court rendering, actions, animation
 * and playback. Contains no court geometry calculations of its own.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DrillDefinition,
  EntityState,
  Location,
  Movement,
  Step,
} from "./definition";
import {
  buildCourtGeometry,
  locationToSvg,
} from "./geometry";
import DrillCourt from "./DrillCourt";
import Participant from "./Participant";
import Ball from "./Ball";
import DrillObject from "./DrillObject";
import MovementArrow from "./MovementArrow";
import DrillStepControls from "./DrillStepControls";

const STEP_DURATION_MS = 1500;

interface Overlay {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

type StateKey = "participants" | "balls" | "objects";
type MoveKey = "participant_id" | "ball_id" | "object_id";

export default function DrillViewer({ definition }: { definition: DrillDefinition }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within current step
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

    const geometry = useMemo(
    () =>
      buildCourtGeometry(
        definition.view?.orientation ?? "top_down",
        definition.court
      ),
    [definition]
  );

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

  // Reset animation state when navigating between steps.
  useEffect(() => {
    setProgress(0);
    startRef.current = null;
  }, [stepIndex]);

  // requestAnimationFrame loop while playing.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / STEP_DURATION_MS);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (stepIndex < steps.length - 1) {
        startRef.current = t;
        setStepIndex((i) => i + 1);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, stepIndex, steps.length]);

  if (!definition || !step) return null;

  const statesKey = (key: MoveKey): StateKey =>
    key === "participant_id" ? "participants" : key === "ball_id" ? "balls" : "objects";

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
    id: string
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
    key: MoveKey
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
        onClick: () => setOverlay((o) => (o?.title === tooltip.title ? null : tooltip)),
      };
      const titleText = tooltip.lines.join(" · ");

      if (key === "participant_id") {
        const p = entityMap.participants[s.id];
        return (
          <Participant key={s.id} id={s.id} type={p?.type ?? "player"} x={x} y={y} title={titleText} {...handlers} />
        );
      }
      if (key === "ball_id") {
        return <Ball key={s.id} id={s.id} x={x} y={y} title={titleText} {...handlers} />;
      }
      return (
        <DrillObject key={s.id} type={entityMap.objects[s.id]?.type ?? "custom"} x={x} y={y} title={titleText} {...handlers} />
      );
    });
  const renderMovements = (
    movements: Movement[] | undefined,
    kind: "participant" | "ball" | "object",
    key: MoveKey
  ) =>
    (movements ?? []).map((m, i) => {
      const from =
        m.from ??
        step[statesKey(key)].find((s) => s.id === m[key])?.location;
      if (!from) return null;
      const f = svg(from);
      const t = svg(m.to);
      return <MovementArrow key={`${m[key]}-${i}`} from={f} to={t} kind={kind} title={m.description} />;
    });

  return (
    <div className="drill-viewer">
      <div className="drill-canvas" data-orientation={definition.view.orientation}>
        <DrillCourt orientation={definition.view.orientation} court={definition.court} />

        <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="drill-entities-svg">
          {renderMovements(step.participant_movements, "participant", "participant_id")}
          {renderMovements(step.ball_movements, "ball", "ball_id")}
          {renderMovements(step.object_movements, "object", "object_id")}
          {renderEntities(step.objects, nextStep?.objects, step.object_movements, "object_id")}
          {renderEntities(step.participants, nextStep?.participants, step.participant_movements, "participant_id")}
          {renderEntities(step.balls, nextStep?.balls, step.ball_movements, "ball_id")}
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

      {step.description && <p className="drill-step-description">{step.description}</p>}

      {step.actions.length > 0 && (
        <ul className="drill-actions">
          {step.actions.map((a, i) => (
            <li key={i}>
              <span className={`tag tag-${a.action.type}`}>{a.action.type}</span>{" "}
              <strong>{a.participant_id}</strong>
              {a.action.description ? ` — ${a.action.description}` : ""}
            </li>
          ))}
        </ul>
      )}

      <DrillStepControls
        stepIndex={stepIndex}
        stepCount={steps.length}
        playing={playing}
        onPrev={() => {
          setPlaying(false);
          setStepIndex((i) => Math.max(0, i - 1));
        }}
        onNext={() => {
          setPlaying(false);
          setStepIndex((i) => Math.min(steps.length - 1, i + 1));
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSelect={(i) => {
          setPlaying(false);
          setStepIndex(i);
        }}
      />
    </div>
  );
}
