import { describe, expect, it } from "vitest";
import type { CourtConfig, CourtId } from "./definition";
import {
  buildCourtGeometry,
  courtBounds,
  isWithinBounds,
  locationToSvg,
} from "./geometry";

const baseCourt: CourtConfig = {
  grid: { columns: 5, rows: 4 },
};

const courtWithAllExtensions: CourtConfig = {
  grid: { columns: 5, rows: 4 },
  extended_area: {
    enabled: true,
    left: true,
    right: true,
    court_1: true,
    court_2: true,
  },
};

describe("buildCourtGeometry — top_down", () => {
  const g = buildCourtGeometry("top_down", baseCourt);

  it("stacks court 1 above court 2 with the net between them", () => {
    expect(g.court1.y).toBeLessThan(g.net.y);
    expect(g.net.y).toBeLessThan(g.court2.y);
    expect(g.court1.y + g.court1.height).toBeLessThan(g.court2.y);
  });

  it("gives both courts the same square dimensions", () => {
    expect(g.court1.width).toBe(g.court2.width);
    expect(g.court1.height).toBe(g.court2.height);
    expect(g.court1.width).toBe(g.court1.height);
  });

  it("uses a net band spanning the full court width", () => {
    expect(g.net.width).toBe(g.court1.width);
    expect(g.net.x).toBe(g.court1.x);
  });

  it("keeps both courts inside the viewport", () => {
    expect(g.width).toBeGreaterThanOrEqual(g.court1.x + g.court1.width);
    expect(g.height).toBeGreaterThanOrEqual(g.court2.y + g.court2.height);
  });

  it("renders side and baseline extensions outside the courts", () => {
    const ext = buildCourtGeometry("top_down", courtWithAllExtensions);
    expect(ext.extensions.left).toBeDefined();
    expect(ext.extensions.right).toBeDefined();
    expect(ext.extensions.court_1).toBeDefined();
    expect(ext.extensions.court_2).toBeDefined();
    // Sideline strips run along the courts; baseline strips run across them.
    expect(ext.extensions.left!.width).toBeLessThan(ext.extensions.left!.height);
    expect(ext.extensions.court_1!.width).toBe(ext.court1.width);
  });

  it("omits all extensions when disabled", () => {
    expect(Object.values(g.extensions).filter(Boolean)).toHaveLength(0);
  });
});

describe("buildCourtGeometry — lateral", () => {
  const g = buildCourtGeometry("lateral", baseCourt);

  it("places courts side by side without overlapping", () => {
    expect(g.court1.x + g.court1.width).toBeLessThan(g.court2.x);
    expect(g.court1.y).toBe(g.court2.y);
    expect(g.court1.height).toBe(g.court2.height);
  });

  it("leaves an explicit net gap between the courts", () => {
    expect(g.net.x).toBeGreaterThanOrEqual(g.court1.x + g.court1.width);
    expect(g.net.x + g.net.width).toBeLessThanOrEqual(g.court2.x);
  });

  it("spans the net band vertically across the courts", () => {
    expect(g.net.height).toBe(g.court1.height);
    expect(g.net.width).toBeLessThan(g.court1.width);
  });
});

describe("courtBounds", () => {
  it("allows x 1..5 and y 1..4 on both courts by default", () => {
    const b = courtBounds(baseCourt);
    expect(b.court_1).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 4 });
    expect(b.court_2).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 4 });
  });

  it("widens x to 0..6 with lateral extensions", () => {
    const b = courtBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, left: true, right: true },
    });
    expect(b.court_1.minX).toBe(0);
    expect(b.court_1.maxX).toBe(6);
    expect(b.court_2.minX).toBe(0);
    expect(b.court_2.maxX).toBe(6);
  });

  it("deepens y per court with baseline extensions", () => {
    const b = courtBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, court_1: true, court_2: true },
    });
    expect(b.court_1.minY).toBe(0);
    expect(b.court_1.maxY).toBe(4);
    expect(b.court_2.minY).toBe(1);
    expect(b.court_2.maxY).toBe(5);
  });
});
describe("locationToSvg", () => {
  const g = buildCourtGeometry("top_down", baseCourt);
  const lateral = buildCourtGeometry("lateral", baseCourt);

  it("maps x=1 and x=columns to the left and right edges (top_down)", () => {
    const left = locationToSvg({ court: "court_1", x: 1, y: 2 }, g);
    const right = locationToSvg({ court: "court_1", x: 5, y: 2 }, g);
    expect(left.x).toBeCloseTo(g.court1.x);
    expect(right.x).toBeCloseTo(g.court1.x + g.court1.width);
  });

  it("maps y=1 to the outer baseline edge for both courts (top_down)", () => {
    const c1 = locationToSvg({ court: "court_1", x: 3, y: 1 }, g);
    const c2 = locationToSvg({ court: "court_2", x: 3, y: 1 }, g);
    expect(c1.y).toBeCloseTo(g.court1.y);
    expect(c2.y).toBeCloseTo(g.court2.y + g.court2.height);
  });

  it("supports fractional coordinates", () => {
    const p = locationToSvg({ court: "court_1", x: 3, y: 2.5 }, g);
    expect(p.y).toBeCloseTo(g.court1.y + g.court1.height / 2);
  });

  it("projects the same logical position differently per orientation", () => {
    const loc = { court: "court_1" as const, x: 3, y: 2 };
    const topDown = locationToSvg(loc, g);
    const side = locationToSvg(loc, lateral);
    expect([topDown.x, topDown.y]).not.toEqual([side.x, side.y]);
  });

  it("maps the sideline axis to screen-y in lateral mode", () => {
    const bottom = locationToSvg({ court: "court_1", x: 1, y: 1 }, lateral);
    const top = locationToSvg({ court: "court_1", x: 5, y: 1 }, lateral);
    expect(bottom.y).toBeCloseTo(lateral.court1.y + lateral.court1.height);
    expect(top.y).toBeCloseTo(lateral.court1.y);
  });

  it("mirrors court 2 in lateral mode (baseline on the outer edge)", () => {
    const c2 = locationToSvg({ court: "court_2", x: 1, y: 1 }, lateral);
    expect(c2.y).toBeCloseTo(lateral.court2.y + lateral.court2.height);
    expect(c2.x).toBeCloseTo(lateral.court2.x + lateral.court2.width);
  });
});

describe("isWithinBounds", () => {
  const b = courtBounds(courtWithAllExtensions);

  it("accepts fractional positions inside the enabled extensions", () => {
    expect(isWithinBounds({ court: "court_1", x: 0.5, y: 2.25 }, b)).toBe(true);
    expect(isWithinBounds({ court: "court_2", x: 3, y: 4.5 }, b)).toBe(true);
  });

  it("rejects positions outside the configured bounds", () => {
    expect(isWithinBounds({ court: "court_1", x: 7, y: 2 }, b)).toBe(false);
    expect(isWithinBounds({ court: "court_1", x: 3, y: -0.5 }, b)).toBe(false);
  });

  it("rejects unknown courts", () => {
    const unknown = "court_9" as CourtId;
    expect(isWithinBounds({ court: unknown, x: 1, y: 1 }, b)).toBe(false);
  });
});