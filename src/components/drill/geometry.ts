/**
 * Side geometry — the single logical→SVG conversion layer.
 *
 * The renderer owns all geometry. Definitions never contain SVG/pixel data.
 * Side identity (side_1 / side_2) is logical; orientation only changes
 * how the geometry is projected onto the SVG viewport.
 */

import type {
  SideConfig,
  SideId,
  ExtendedArea,
  Location,
  Orientation,
} from "./definition";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SideGeometry {
  /** Viewport size the geometry was built for. */
  width: number;
  height: number;
  orientation: Orientation;
  side1: Rect;
  side2: Rect;
  net: Rect;
  /** Physical extended areas keyed by their physical meaning. */
  extensions: {
    left?: Rect;
    right?: Rect;
    side_1?: Rect;
    side_2?: Rect;
  };
  grid: { columns: number; rows: number };
  /** Logical x-range/y-range allowed per side given the extensions. */
  bounds: Record<SideId, { minX: number; maxX: number; minY: number; maxY: number }>;
}

// Layout constants (SVG units)
const MARGIN = 40;
/** Sides are square: one constant sizes both axes so they can never diverge. */
const SIDE_SIZE = 400;
const NET_GAP = 36;
/**
 * Thickness of an extended-area strip. Fixed display constant, independent
 * of the grid step: the grid step measures line spacing inside the side,
 * the strip is physical space outside it.
 */
const EXT_SIZE = 48;

/**
 * Compute the logical coordinate bounds for a side from its configuration.
 * Normal side: x 1..5, y 1..4. Lateral extensions widen x (0..6);
 * baseline extensions deepen y (side_1: 0..4, side_2: 1..5).
 */
export function sideBounds(side: SideConfig): Record<
  SideId,
  { minX: number; maxX: number; minY: number; maxY: number }
> {
  const ext: ExtendedArea = side.extended_area ?? { enabled: false };
  const lateral = ext.enabled && (ext.left || ext.right);
  const base1 = ext.enabled && ext.side_1;
  const base2 = ext.enabled && ext.side_2;

  const minX = lateral ? 0 : 1;
  const maxX = lateral ? side.grid.columns + 1 : side.grid.columns;

  return {
    side_1: { minX, maxX, minY: base1 ? 0 : 1, maxY: side.grid.rows },
    side_2: {
      minX,
      maxX,
      minY: 1,
      maxY: base2 ? side.grid.rows + 1 : side.grid.rows,
    },
  };
}

/** Validate that a location is inside the allowed logical bounds. */
export function isWithinBounds(
  location: Location,
  bounds: SideGeometry["bounds"]
): boolean {
  const b = bounds[location.side];
  if (!b) return false;
  return (
    location.x >= b.minX &&
    location.x <= b.maxX &&
    location.y >= b.minY &&
    location.y <= b.maxY
  );
}

/**
 * Build SVG geometry for both sides and the net.
 *
 * top_down: sides stacked vertically with the net between them.
 * lateral:  sides side-by-side with an explicit net gap — two independent
 *           bounding boxes, never overlapping.
 *
 * Physical meaning of the extensions (screen-independent):
 *   left / right = sideline-side strips (lateral extensions)
 *   side_1 / side_2 = strips beyond the respective baselines
 *
 * Projection onto the screen:
 *   top_down — sideline axis is horizontal, baseline→net axis is vertical:
 *     left  → strips along the left edge of each side
 *     right → strips along the right edge of each side
 *     side_1 → strip above side 1, side_2 → strip below side 2
 *   lateral — the side is rotated 90° (baseline→net axis is horizontal):
 *     left  → strips along the top edge of both sides
 *     right → strips along the bottom edge of both sides
 *     side_1 → strip on the outer (left) edge of side 1
 *     side_2 → strip on the outer (right) edge of side 2
 *
 * All strips share one fixed modest thickness (EXT_SIZE); enabling left/right
 * only adds the side strips and never changes the baseline strips.
 */
export function buildSideGeometry(
  orientation: Orientation,
  side: SideConfig
): SideGeometry {
  const ext: ExtendedArea = side.extended_area ?? { enabled: false };
  const hasLeft = ext.enabled && ext.left;
  const hasRight = ext.enabled && ext.right;
  const hasBase1 = ext.enabled && ext.side_1;
  const hasBase2 = ext.enabled && ext.side_2;

  if (orientation === "top_down") {
    const width =
      SIDE_SIZE + MARGIN * 2 + (hasLeft ? EXT_SIZE : 0) + (hasRight ? EXT_SIZE : 0);
    const height =
      SIDE_SIZE * 2 + NET_GAP + MARGIN * 2 + (hasBase1 ? EXT_SIZE : 0) + (hasBase2 ? EXT_SIZE : 0);
    const offsetX = MARGIN + (hasLeft ? EXT_SIZE : 0);
    const offsetY = MARGIN + (hasBase1 ? EXT_SIZE : 0);

    const side1: Rect = { x: offsetX, y: offsetY, width: SIDE_SIZE, height: SIDE_SIZE };
    const net: Rect = {
      x: offsetX,
      y: offsetY + SIDE_SIZE,
      width: SIDE_SIZE,
      height: NET_GAP,
    };
    const side2: Rect = {
      x: offsetX,
      y: offsetY + SIDE_SIZE + NET_GAP,
      width: SIDE_SIZE,
      height: SIDE_SIZE,
    };

    return {
      width,
      height,
      orientation,
      side1,
      side2,
      net,
      grid: side.grid,
      extensions: {
        left: hasLeft
          ? {
              x: side1.x - EXT_SIZE,
              y: Math.min(side1.y, side2.y),
              width: EXT_SIZE,
              height: SIDE_SIZE * 2 + NET_GAP,
            }
          : undefined,
        right: hasRight
          ? {
              x: side1.x + SIDE_SIZE,
              y: Math.min(side1.y, side2.y),
              width: EXT_SIZE,
              height: SIDE_SIZE * 2 + NET_GAP,
            }
          : undefined,
        side_1: hasBase1
          ? { x: side1.x, y: side1.y - EXT_SIZE, width: SIDE_SIZE, height: EXT_SIZE }
          : undefined,
        side_2: hasBase2
          ? { x: side2.x, y: side2.y + SIDE_SIZE, width: SIDE_SIZE, height: EXT_SIZE }
          : undefined,
      },
      bounds: sideBounds(side),
    };
  }

  // lateral: side-by-side, independent boxes, net gap between them.
  // The baseline→net axis (y) is horizontal; the sideline axis (x) is vertical.
  const width =
    SIDE_SIZE * 2 + NET_GAP + MARGIN * 2 + (hasBase1 ? EXT_SIZE : 0) + (hasBase2 ? EXT_SIZE : 0);
  const height = SIDE_SIZE + MARGIN * 2 + (hasLeft ? EXT_SIZE : 0) + (hasRight ? EXT_SIZE : 0);
  const offsetX = MARGIN + (hasBase1 ? EXT_SIZE : 0);
  const offsetY = MARGIN + (hasLeft ? EXT_SIZE : 0);

  const side1: Rect = { x: offsetX, y: offsetY, width: SIDE_SIZE, height: SIDE_SIZE };
  const net: Rect = {
    x: offsetX + SIDE_SIZE,
    y: offsetY,
    width: NET_GAP,
    height: SIDE_SIZE,
  };
  const side2: Rect = {
    x: offsetX + SIDE_SIZE + NET_GAP,
    y: offsetY,
    width: SIDE_SIZE,
    height: SIDE_SIZE,
  };

  return {
    width,
    height,
    orientation,
    side1,
    side2,
    net,
    grid: side.grid,
    extensions: {
      left: hasLeft
        ? {
            x: Math.min(side1.x, side2.x),
            y: side1.y - EXT_SIZE,
            width: SIDE_SIZE * 2 + NET_GAP,
            height: EXT_SIZE,
          }
        : undefined,
      right: hasRight
        ? {
            x: Math.min(side1.x, side2.x),
            y: side1.y + SIDE_SIZE,
            width: SIDE_SIZE * 2 + NET_GAP,
            height: EXT_SIZE,
          }
        : undefined,
      side_1: hasBase1
        ? { x: side1.x - EXT_SIZE, y: side1.y, width: EXT_SIZE, height: SIDE_SIZE }
        : undefined,
      side_2: hasBase2
        ? { x: side2.x + SIDE_SIZE, y: side2.y, width: EXT_SIZE, height: SIDE_SIZE }
        : undefined,
    },
    bounds: sideBounds(side),
  };
}

/**
 * Convert a logical location into SVG coordinates.
 * This is the only place logical→SVG conversion happens.
 *
 * Physical meaning of the logical axes (independent of orientation):
 *   x = sideline-to-sideline (1..columns); x=1 is always the same sideline side
 *   y = baseline-to-net      (1..rows);    y=1 is always the baseline (back)
 *
 * The rule holds identically for both sides. Side 2 is mirrored so its
 * baseline stays on its outer edge:
 *
 * top_down (long axis y is vertical, x is horizontal):
 *   x=1 → left edge of the rect, both sides
 *   y=1 → outer edge: top edge of side 1, bottom edge of side 2
 * lateral (side rotated 90°: long axis y is horizontal, x is vertical):
 *   x=1 → bottom edge of the rect, both sides
 *   y=1 → outer edge: left edge of side 1, right edge of side 2
 */
export function locationToSvg(
  location: Location,
  geometry: SideGeometry
): { x: number; y: number } {
  const rect = location.side === "side_1" ? geometry.side1 : geometry.side2;
  const mirror = location.side === "side_2";
  const { columns, rows } = geometry.grid;

  if (geometry.orientation === "lateral") {
    // x=1 at the bottom edge, both sides; side 2 mirrored on y.
    const x = rect.x + ((location.y - 1) / (rows - 1)) * rect.width;
    const y = rect.y + rect.height - ((location.x - 1) / (columns - 1)) * rect.height;
    return {
      x: mirror ? 2 * rect.x + rect.width - x : x,
      y,
    };
  }

  // x=1 at the left edge, both sides; side 2 mirrored on y.
  const x = rect.x + ((location.x - 1) / (columns - 1)) * rect.width;
  const y = rect.y + ((location.y - 1) / (rows - 1)) * rect.height;
  return {
    x,
    y: mirror ? 2 * rect.y + rect.height - y : y,
  };
}