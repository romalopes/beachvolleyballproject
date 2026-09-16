/**
 * playback.ts — the shared step-playback geometry.
 *
 * `entityFramePoint` is the single interpolation rule used by both the viewer
 * and the editor's visualisation: at rest it returns the current step state's
 * SVG point, while playing it lerps the movement's endpoints in SVG space.
 *
 * A `Location` cannot represent "between sides", so cross-side flights must
 * interpolate in SVG space — pinning the whole trajectory to the target side
 * flattens the launch point into the wrong side. Each endpoint is converted
 * with its OWN side before the pixels are lerped.
 *
 * `statesKeyFor` maps a movement's id key to the step array holding the entity
 * state, so callers do not repeat that switch.
 */

import type { EntityState, Location, Movement } from "./definition";

/** Base step duration before the viewer's speed multiplier. */
export const STEP_DURATION_MS = 1500;

/** The `*_id` key a movement carries, per entity family. */
export type MoveKey = "participant_id" | "ball_id" | "object_id";

/** The step array a movement's id key points into. */
export type StateKey = "participants" | "balls" | "objects";

export function statesKeyFor(key: MoveKey): StateKey {
  if (key === "participant_id") return "participants";
  if (key === "ball_id") return "balls";
  return "objects";
}

/** SVG point for an entity at the current animation frame. */
export function entityFramePoint({
  states,
  nextStates,
  movements,
  key,
  id,
  progress,
  playing,
  toSvg,
}: {
  states: EntityState[];
  nextStates: EntityState[] | undefined;
  movements: Movement[] | undefined;
  key: MoveKey;
  id: string;
  progress: number;
  playing: boolean;
  toSvg: (location: Location) => { x: number; y: number };
}): { x: number; y: number } | null {
  const current = states.find((s) => s.id === id && s.active);
  if (!current?.location) return null;
  const movement = movements?.find((m) => m[key] === id);
  if (!movement || !playing || progress === 0) return toSvg(current.location);
  const fromLoc = movement.from ?? current.location;
  const toLoc =
    movement.to ??
    nextStates?.find((s) => s.id === id && s.active)?.location ??
    current.location;
  const fromSvg = toSvg(fromLoc);
  const toSvgPoint = toSvg(toLoc);
  return {
    x: fromSvg.x + (toSvgPoint.x - fromSvg.x) * progress,
    y: fromSvg.y + (toSvgPoint.y - fromSvg.y) * progress,
  };
}
