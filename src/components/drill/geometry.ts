/**
 * Court geometry — the single logical→SVG conversion layer.
 *
 * The renderer owns all geometry. Definitions never contain SVG/pixel data.
 * Court identity (court_1 / court_2) is logical; orientation only changes
 * how the geometry is projected onto the SVG viewport.
 */

import type {
  CourtConfig,
  CourtId,
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

export interface CourtGeometry {
  /** Viewport size the geometry was built for. */
  width: number;
  height: number;
  orientation: Orientation;
  court1: Rect;
  court2: Rect;
  net: Rect;
  /** Physical extended areas keyed by their physical meaning. */
  extensions: {
    left?: Rect;
    right?: Rect;
    court_1?: Rect;
    court_2?: Rect;
  };
  grid: { columns: number; rows: number };
  /** Logical x-range/y-range allowed per court given the extensions. */
  bounds: Record<CourtId, { minX: number; maxX: number; minY: number; maxY: number }>;
}

// Layout constants (SVG units)
const MARGIN = 40;
const COURT_W = 400;
const COURT_H = 320;
const NET_GAP = 36;
/**
 * Thickness of an extended-area strip. Fixed display constant, independent
 * of the grid step: the grid step measures line spacing inside the court,
 * the strip is physical space outside it.
 */
const EXT_SIZE = 48;

/**
 * Compute the logical coordinate bounds for a court from its configuration.
 * Normal court: x 1..5, y 1..4. Lateral extensions widen x (0..6);
 * baseline extensions deepen y (court_1: 0..4, court_2: 1..5).
 */
export function courtBounds(court: CourtConfig): Record<
  CourtId,
  { minX: number; maxX: number; minY: number; maxY: number }
> {
  const ext: ExtendedArea = court.extended_area ?? { enabled: false };
  const lateral = ext.enabled && (ext.left || ext.right);
  const base1 = ext.enabled && ext.court_1;
  const base2 = ext.enabled && ext.court_2;

  const minX = lateral ? 0 : 1;
  const maxX = lateral ? court.grid.columns + 1 : court.grid.columns;

  return {
    court_1: { minX, maxX, minY: base1 ? 0 : 1, maxY: court.grid.rows },
    court_2: {
      minX,
      maxX,
      minY: 1,
      maxY: base2 ? court.grid.rows + 1 : court.grid.rows,
    },
  };
}

/** Validate that a location is inside the allowed logical bounds. */
export function isWithinBounds(
  location: Location,
  bounds: CourtGeometry["bounds"]
): boolean {
  const b = bounds[location.court];
  if (!b) return false;
  return (
    location.x >= b.minX &&
    location.x <= b.maxX &&
    location.y >= b.minY &&
    location.y <= b.maxY
  );
}

/**
 * Build SVG geometry for both courts and the net.
 *
 * top_down: courts stacked vertically with the net between them.
 * lateral:  courts side-by-side with an explicit net gap — two independent
 *           bounding boxes, never overlapping.
 *
 * Physical meaning of the extensions (screen-independent):
 *   left / right = sideline-side strips (lateral extensions)
 *   court_1 / court_2 = strips beyond the respective baselines
 *
 * Projection onto the screen:
 *   top_down — sideline axis is horizontal, baseline→net axis is vertical:
 *     left  → strips along the left edge of each court
 *     right → strips along the right edge of each court
 *     court_1 → strip above court 1, court_2 → strip below court 2
 *   lateral — the court is rotated 90° (baseline→net axis is horizontal):
 *     left  → strips along the top edge of both courts
 *     right → strips along the bottom edge of both courts
 *     court_1 → strip on the outer (left) edge of court 1
 *     court_2 → strip on the outer (right) edge of court 2
 *
 * All strips share one fixed modest thickness (EXT_SIZE); enabling left/right
 * only adds the side strips and never changes the baseline strips.
 */
export function buildCourtGeometry(
  orientation: Orientation,
  court: CourtConfig
): CourtGeometry {
  const ext: ExtendedArea = court.extended_area ?? { enabled: false };
  const hasLeft = ext.enabled && ext.left;
  const hasRight = ext.enabled && ext.right;
  const hasBase1 = ext.enabled && ext.court_1;
  const hasBase2 = ext.enabled && ext.court_2;

  if (orientation === "top_down") {
    const width =
      COURT_W + MARGIN * 2 + (hasLeft ? EXT_SIZE : 0) + (hasRight ? EXT_SIZE : 0);
    const height =
      COURT_H * 2 + NET_GAP + MARGIN * 2 + (hasBase1 ? EXT_SIZE : 0) + (hasBase2 ? EXT_SIZE : 0);
    const offsetX = MARGIN + (hasLeft ? EXT_SIZE : 0);
    const offsetY = MARGIN + (hasBase1 ? EXT_SIZE : 0);

    const court1: Rect = { x: offsetX, y: offsetY, width: COURT_W, height: COURT_H };
    const net: Rect = {
      x: offsetX,
      y: offsetY + COURT_H,
      width: COURT_W,
      height: NET_GAP,
    };
    const court2: Rect = {
      x: offsetX,
      y: offsetY + COURT_H + NET_GAP,
      width: COURT_W,
      height: COURT_H,
    };

    return {
      width,
      height,
      orientation,
      court1,
      court2,
      net,
      grid: court.grid,
      extensions: {
        left: hasLeft
          ? {
              x: court1.x - EXT_SIZE,
              y: Math.min(court1.y, court2.y),
              width: EXT_SIZE,
              height: COURT_H * 2 + NET_GAP,
            }
          : undefined,
        right: hasRight
          ? {
              x: court1.x + COURT_W,
              y: Math.min(court1.y, court2.y),
              width: EXT_SIZE,
              height: COURT_H * 2 + NET_GAP,
            }
          : undefined,
        court_1: hasBase1
          ? { x: court1.x, y: court1.y - EXT_SIZE, width: COURT_W, height: EXT_SIZE }
          : undefined,
        court_2: hasBase2
          ? { x: court2.x, y: court2.y + COURT_H, width: COURT_W, height: EXT_SIZE }
          : undefined,
      },
      bounds: courtBounds(court),
    };
  }

  // lateral: side-by-side, independent boxes, net gap between them.
  // The baseline→net axis (y) is horizontal; the sideline axis (x) is vertical.
  const width =
    COURT_W * 2 + NET_GAP + MARGIN * 2 + (hasBase1 ? EXT_SIZE : 0) + (hasBase2 ? EXT_SIZE : 0);
  const height = COURT_H + MARGIN * 2 + (hasLeft ? EXT_SIZE : 0) + (hasRight ? EXT_SIZE : 0);
  const offsetX = MARGIN + (hasBase1 ? EXT_SIZE : 0);
  const offsetY = MARGIN + (hasLeft ? EXT_SIZE : 0);

  const court1: Rect = { x: offsetX, y: offsetY, width: COURT_W, height: COURT_H };
  const net: Rect = {
    x: offsetX + COURT_W,
    y: offsetY,
    width: NET_GAP,
    height: COURT_H,
  };
  const court2: Rect = {
    x: offsetX + COURT_W + NET_GAP,
    y: offsetY,
    width: COURT_W,
    height: COURT_H,
  };

  return {
    width,
    height,
    orientation,
    court1,
    court2,
    net,
    grid: court.grid,
    extensions: {
      left: hasLeft
        ? {
            x: Math.min(court1.x, court2.x),
            y: court1.y - EXT_SIZE,
            width: COURT_W * 2 + NET_GAP,
            height: EXT_SIZE,
          }
        : undefined,
      right: hasRight
        ? {
            x: Math.min(court1.x, court2.x),
            y: court1.y + COURT_H,
            width: COURT_W * 2 + NET_GAP,
            height: EXT_SIZE,
          }
        : undefined,
      court_1: hasBase1
        ? { x: court1.x - EXT_SIZE, y: court1.y, width: EXT_SIZE, height: COURT_H }
        : undefined,
      court_2: hasBase2
        ? { x: court2.x + COURT_W, y: court2.y, width: EXT_SIZE, height: COURT_H }
        : undefined,
    },
    bounds: courtBounds(court),
  };
}

/**
 * Convert a logical location into SVG coordinates.
 * This is the only place logical→SVG conversion happens.
 *
 * Physical meaning of the logical axes (independent of orientation):
 *   x = sideline-to-sideline (1..columns)
 *   y = baseline-to-net      (1..rows; y=1 is the baseline side)
 *
 * top_down: the long axis (y) is vertical, x is horizontal.
 * lateral:  the court is rotated 90° — the long axis (y) becomes horizontal
 *           (baseline outer edge → net gap), x becomes vertical.
 */
export function locationToSvg(
  location: Location,
  geometry: CourtGeometry
): { x: number; y: number } {
  const rect = location.court === "court_1" ? geometry.court1 : geometry.court2;
  const { columns, rows } = geometry.grid;

  if (geometry.orientation === "lateral") {
    const x = rect.x + ((location.y - 1) / (rows - 1)) * rect.width;
    const y = rect.y + ((location.x - 1) / (columns - 1)) * rect.height;
    return { x, y };
  }

  const x = rect.x + ((location.x - 1) / (columns - 1)) * rect.width;
  const y = rect.y + ((location.y - 1) / (rows - 1)) * rect.height;
  return { x, y };
}