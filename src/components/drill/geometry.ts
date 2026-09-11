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
const EXT_SIZE = 60; // thickness of an extended area strip

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
 */
export function buildCourtGeometry(
  orientation: Orientation,
  court: CourtConfig
): CourtGeometry {
  const ext: ExtendedArea = court.extended_area ?? { enabled: false };

  if (orientation === "top_down") {
    const innerW = COURT_W;
    const innerH = COURT_H * 2 + NET_GAP;
    const width = innerW + MARGIN * 2 + (ext.enabled ? EXT_SIZE * 2 : 0);
    const height = innerH + MARGIN * 2 + (ext.enabled ? EXT_SIZE * 2 : 0);
    const offsetX = MARGIN + (ext.enabled ? EXT_SIZE : 0);
    const offsetY = MARGIN + (ext.enabled ? EXT_SIZE : 0);

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
        court_1: ext.enabled && ext.court_1
          ? { x: court1.x, y: court1.y - EXT_SIZE, width: COURT_W, height: EXT_SIZE }
          : undefined,
        court_2: ext.enabled && ext.court_2
          ? { x: court2.x, y: court2.y + COURT_H, width: COURT_W, height: EXT_SIZE }
          : undefined,
      },
      bounds: courtBounds(court),
    };
  }

  // lateral: side-by-side, independent boxes, net gap between them
  const innerW = COURT_W * 2 + NET_GAP;
  const innerH = COURT_H;
  const width = innerW + MARGIN * 2;
  const height = innerH + MARGIN * 2 + (ext.enabled ? EXT_SIZE * 2 : 0);
  const offsetX = MARGIN;
  const offsetY = MARGIN + (ext.enabled ? EXT_SIZE : 0);

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
      court_1: ext.enabled && ext.court_1
        ? { x: court1.x - EXT_SIZE, y: court1.y, width: EXT_SIZE, height: COURT_H }
        : undefined,
      court_2: ext.enabled && ext.court_2
        ? { x: court2.x + COURT_W, y: court2.y, width: EXT_SIZE, height: COURT_H }
        : undefined,
    },
    bounds: courtBounds(court),
  };
}

/**
 * Convert a logical location into SVG coordinates.
 * This is the only place logical→SVG conversion happens.
 */
export function locationToSvg(
  location: Location,
  geometry: CourtGeometry
): { x: number; y: number } {
  const rect = location.court === "court_1" ? geometry.court1 : geometry.court2;
  const { columns, rows } = geometry.grid;
  // x: 1..columns maps across the court width; y: 1..rows maps down its height.
  const x = rect.x + ((location.x - 1) / (columns - 1)) * rect.width;
  const y = rect.y + ((location.y - 1) / (rows - 1)) * rect.height;
  return { x, y };
}