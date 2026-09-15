/**
 * InteractiveCourt — the visual builder's editable court.
 *
 * Renders exactly what the viewer renders (`DrillSide` plus the same entity
 * components) under a pointer-enabled overlay with identical geometry, so the
 * builder can never drift from the finished drill. Pointer positions become
 * logical `Location`s via `pointToLocation` (the inverse of `locationToSvg`) and
 * are clamped with `editorBounds` — the Rails rule — so a drag can only produce
 * a definition the server accepts.
 *
 * Two layers are shown at once:
 *   • `current` — the step being edited (solid, draggable);
 *   • `next`    — the following step (translucent ghosts, draggable too), which
 *     is where a movement's `to` comes from.
 */

import { useMemo, useRef, useState } from "react";
import type {
  Ball,
  DrillDefinition,
  DrillObject,
  EntityState,
  Location,
  Movement,
  Orientation,
  Participant,
  Step,
} from "../../../drill/definition";
import {
  buildSideGeometry,
  editorBounds,
  locationToSvg,
  pointToLocation,
} from "../../../drill/geometry";
import DrillSide from "../../../drill/DrillSide";
import ParticipantMark from "../../../drill/Participant";
import BallMark from "../../../drill/Ball";
import DrillObjectMark from "../../../drill/DrillObject";
import MovementArrow from "../../../drill/MovementArrow";
import { activeLocations, type EntityKind } from "./drill-model";

/** Which step a drag is editing: the one on screen, or the following one. */
export type Layer = "current" | "next";

export interface InteractiveCourtProps {
  definition: DrillDefinition;
  orientation: Orientation;
  stepIndex: number;
  selected: { kind: EntityKind; id: string } | null;
  onSelect: (kind: EntityKind, id: string) => void;
  onMove: (
    kind: EntityKind,
    id: string,
    location: Location,
    layer: Layer,
  ) => void;
  /** A press on empty court; carries the snapped logical location. */
  onCourtClick: (location: Location) => void;
}

const ENTITY_KINDS: EntityKind[] = ["participants", "balls", "objects"];

interface DragState {
  kind: EntityKind;
  id: string;
  layer: Layer;
  location: Location;
}

export default function InteractiveCourt({
  definition,
  orientation,
  stepIndex,
  selected,
  onSelect,
  onMove,
  onCourtClick,
}: InteractiveCourtProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const geometry = useMemo(
    () => buildSideGeometry(orientation, definition.side),
    [orientation, definition.side],
  );
  const bounds = useMemo(() => editorBounds(definition.side), [definition.side]);

  const currentStep: Step | undefined = definition.steps[stepIndex];
  const nextStep: Step | undefined = definition.steps[stepIndex + 1];

  const catalog = useMemo(
    () => ({
      participants: Object.fromEntries(
        definition.participants.map((p) => [p.id, p]),
      ) as Record<string, Participant>,
      balls: Object.fromEntries(
        definition.balls.map((b) => [b.id, b]),
      ) as Record<string, Ball>,
      objects: Object.fromEntries(
        definition.objects.map((o) => [o.id, o]),
      ) as Record<string, DrillObject>,
    }),
    [definition],
  );

  const entityType = (kind: EntityKind, id: string): string => {
    switch (kind) {
      case "participants":
        return catalog.participants[id]?.type ?? "player";
      case "balls":
        return catalog.balls[id]?.type ?? "volleyball";
      case "objects":
        return catalog.objects[id]?.type ?? "custom";
    }
  };

  /**
   * Client coordinates → snapped logical location. `width: 100%` plus
   * `height: auto` on the SVG keeps the viewBox aspect ratio exact, so a single
   * uniform scale maps screen space back into viewBox space.
   */
  const locationFromEvent = (event: {
    clientX: number;
    clientY: number;
  }): Location | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scale = geometry.width / rect.width;
    return pointToLocation(
      {
        x: (event.clientX - rect.left) * scale,
        y: (event.clientY - rect.top) * scale,
      },
      geometry,
      { bounds },
    );
  };

  const handleSurfacePointerDown = (event: React.PointerEvent) => {
    const location = locationFromEvent(event);
    if (location) onCourtClick(location);
  };

  const startDrag = (
    event: React.PointerEvent,
    kind: EntityKind,
    id: string,
    layer: Layer,
    location: Location,
  ) => {
    // Keep the press away from the empty-court handler underneath.
    event.stopPropagation();
    svgRef.current?.setPointerCapture?.(event.pointerId);
    onSelect(kind, id);
    setDrag({ kind, id, layer, location });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const location = locationFromEvent(event);
    if (!location) return;
    setDrag({ ...drag, location });
    onMove(drag.kind, drag.id, location, drag.layer);
  };

  const handlePointerUp = () => {
    if (drag) setDrag(null);
  };

  const renderEntity = (
    kind: EntityKind,
    id: string,
    type: string,
    x: number,
    y: number,
  ) => {
    const title = `${id}${type ? ` — ${type}` : ""}`;
    if (kind === "participants") {
      return <ParticipantMark id={id} type={type} x={x} y={y} title={title} />;
    }
    if (kind === "balls") {
      return <BallMark id={id} x={x} y={y} title={title} />;
    }
    return <DrillObjectMark type={type} x={x} y={y} title={title} />;
  };

  const renderLayer = (step: Step | undefined, layer: Layer) =>
    step
      ? ENTITY_KINDS.flatMap((kind) =>
          step[kind].map((state: EntityState) => {
            // Nothing placed: neither drawable nor draggable yet.
            if (!state.location) return null;
            const { x, y } = locationToSvg(state.location, geometry);
            const isSelected =
              selected?.kind === kind && selected.id === state.id;
            return (
              <g
                key={`${layer}-${kind}-${state.id}`}
                className={`drill-builder-marker drill-builder-marker-${layer}${
                  state.active ? "" : " drill-builder-marker-off"
                }${isSelected ? " selected" : ""}`}
                data-layer={layer}
                data-entity-kind={kind}
                data-entity-id={state.id}
                role="button"
                aria-label={`${
                  layer === "current" ? "Position" : "Next position"
                } of ${state.id}`}
                onPointerDown={(event) =>
                  startDrag(event, kind, state.id, layer, state.location!)
                }
              >
                {renderEntity(kind, state.id, entityType(kind, state.id), x, y)}
              </g>
            );
          }),
        )
      : null;

  /** Arrows for the current step, reusing the viewer's arrow component. */
  const renderArrowsOfKind = (
    states: EntityState[],
    movements: Movement[],
    arrowKind: "participant" | "ball" | "object",
    idKey: "participant_id" | "ball_id" | "object_id",
  ) =>
    movements.map((movement, index) => {
      const id = (movement as unknown as Record<string, unknown>)[idKey] as
        | string
        | undefined;
      if (!id) return null;
      const from = movement.from ?? activeLocations(states).get(id);
      if (!from) return null;
      return (
        <MovementArrow
          key={`${arrowKind}-${id}-${index}`}
          from={locationToSvg(from, geometry)}
          to={locationToSvg(movement.to, geometry)}
          kind={arrowKind}
          title={movement.description}
        />
      );
    });

  if (!currentStep) return null;

  return (
    <div
      className="drill-canvas drill-builder-canvas"
      data-orientation={orientation}
    >
      <DrillSide orientation={orientation} side={definition.side} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className="drill-entities-svg drill-builder-layer"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Empty-court press target, painted under everything else. */}
        <rect
          className="drill-builder-surface"
          x={0}
          y={0}
          width={geometry.width}
          height={geometry.height}
          onPointerDown={handleSurfacePointerDown}
        />

        {renderLayer(nextStep, "next")}
        {renderArrowsOfKind(
          currentStep.participants,
          currentStep.participant_movements,
          "participant",
          "participant_id",
        )}
        {renderArrowsOfKind(
          currentStep.balls,
          currentStep.ball_movements,
          "ball",
          "ball_id",
        )}
        {renderArrowsOfKind(
          currentStep.objects,
          currentStep.object_movements,
          "object",
          "object_id",
        )}
        {renderLayer(currentStep, "current")}

        {drag && (
          <g
            className="drill-builder-crosshair"
            transform={`translate(${
              locationToSvg(drag.location, geometry).x
            }, ${locationToSvg(drag.location, geometry).y})`}
          >
            <line x1={-9} y1={0} x2={9} y2={0} />
            <line x1={0} y1={-9} x2={0} y2={9} />
          </g>
        )}
      </svg>
    </div>
  );
}