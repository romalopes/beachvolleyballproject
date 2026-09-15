import { describe, expect, it } from "vitest";
import type { SideConfig, SideId } from "./definition";
import {
  buildSideGeometry,
  editorBounds,
  sideBounds,
  isWithinBounds,
  locationToSvg,
  pointToLocation,
} from "./geometry";

const baseSide: SideConfig = {
  grid: { columns: 5, rows: 4 },
};

const sideWithAllExtensions: SideConfig = {
  grid: { columns: 5, rows: 4 },
  extended_area: {
    enabled: true,
    left: true,
    right: true,
    side_1: true,
    side_2: true,
  },
};

describe("buildSideGeometry — top_down", () => {
  const g = buildSideGeometry("top_down", baseSide);

  it("stacks side 1 above side 2 with the net between them", () => {
    expect(g.side1.y).toBeLessThan(g.net.y);
    expect(g.net.y).toBeLessThan(g.side2.y);
    expect(g.side1.y + g.side1.height).toBeLessThan(g.side2.y);
  });

  it("gives both sides the same square dimensions", () => {
    expect(g.side1.width).toBe(g.side2.width);
    expect(g.side1.height).toBe(g.side2.height);
    expect(g.side1.width).toBe(g.side1.height);
  });

  it("uses a net band spanning the full side width", () => {
    expect(g.net.width).toBe(g.side1.width);
    expect(g.net.x).toBe(g.side1.x);
  });

  it("keeps both sides inside the viewport", () => {
    expect(g.width).toBeGreaterThanOrEqual(g.side1.x + g.side1.width);
    expect(g.height).toBeGreaterThanOrEqual(g.side2.y + g.side2.height);
  });

  it("renders side and baseline extensions outside the sides", () => {
    const ext = buildSideGeometry("top_down", sideWithAllExtensions);
    expect(ext.extensions.left).toBeDefined();
    expect(ext.extensions.right).toBeDefined();
    expect(ext.extensions.side_1).toBeDefined();
    expect(ext.extensions.side_2).toBeDefined();
    // Sideline strips run along the sides; baseline strips run across them.
    expect(ext.extensions.left!.width).toBeLessThan(ext.extensions.left!.height);
    expect(ext.extensions.side_1!.width).toBe(ext.side1.width);
  });

  it("omits all extensions when disabled", () => {
    expect(Object.values(g.extensions).filter(Boolean)).toHaveLength(0);
  });
});

describe("buildSideGeometry — lateral", () => {
  const g = buildSideGeometry("lateral", baseSide);

  it("places sides side by side without overlapping", () => {
    expect(g.side1.x + g.side1.width).toBeLessThan(g.side2.x);
    expect(g.side1.y).toBe(g.side2.y);
    expect(g.side1.height).toBe(g.side2.height);
  });

  it("leaves an explicit net gap between the sides", () => {
    expect(g.net.x).toBeGreaterThanOrEqual(g.side1.x + g.side1.width);
    expect(g.net.x + g.net.width).toBeLessThanOrEqual(g.side2.x);
  });

  it("spans the net band vertically across the sides", () => {
    expect(g.net.height).toBe(g.side1.height);
    expect(g.net.width).toBeLessThan(g.side1.width);
  });
});

describe("sideBounds", () => {
  it("allows x 1..5 and y 1..4 on both sides by default", () => {
    const b = sideBounds(baseSide);
    expect(b.side_1).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 4 });
    expect(b.side_2).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 4 });
  });

  it("widens x to 0..6 with lateral extensions", () => {
    const b = sideBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, left: true, right: true },
    });
    expect(b.side_1.minX).toBe(0);
    expect(b.side_1.maxX).toBe(6);
    expect(b.side_2.minX).toBe(0);
    expect(b.side_2.maxX).toBe(6);
  });

  it("deepens y per side with baseline extensions", () => {
    const b = sideBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, side_1: true, side_2: true },
    });
    expect(b.side_1.minY).toBe(0);
    expect(b.side_1.maxY).toBe(4);
    expect(b.side_2.minY).toBe(1);
    expect(b.side_2.maxY).toBe(5);
  });
});
describe("locationToSvg", () => {
  const g = buildSideGeometry("top_down", baseSide);
  const lateral = buildSideGeometry("lateral", baseSide);

  it("maps x=1 and x=columns to the left and right edges (top_down)", () => {
    const left = locationToSvg({ side: "side_1", x: 1, y: 2 }, g);
    const right = locationToSvg({ side: "side_1", x: 5, y: 2 }, g);
    expect(left.x).toBeCloseTo(g.side1.x);
    expect(right.x).toBeCloseTo(g.side1.x + g.side1.width);
  });

  it("maps y=1 to the outer baseline edge for both sides (top_down)", () => {
    const c1 = locationToSvg({ side: "side_1", x: 3, y: 1 }, g);
    const c2 = locationToSvg({ side: "side_2", x: 3, y: 1 }, g);
    expect(c1.y).toBeCloseTo(g.side1.y);
    expect(c2.y).toBeCloseTo(g.side2.y + g.side2.height);
  });

  it("supports fractional coordinates", () => {
    const p = locationToSvg({ side: "side_1", x: 3, y: 2.5 }, g);
    expect(p.y).toBeCloseTo(g.side1.y + g.side1.height / 2);
  });

  it("projects the same logical position differently per orientation", () => {
    const loc = { side: "side_1" as const, x: 3, y: 2 };
    const topDown = locationToSvg(loc, g);
    const side = locationToSvg(loc, lateral);
    expect([topDown.x, topDown.y]).not.toEqual([side.x, side.y]);
  });

  it("maps the sideline axis to screen-y in lateral mode", () => {
    const bottom = locationToSvg({ side: "side_1", x: 1, y: 1 }, lateral);
    const top = locationToSvg({ side: "side_1", x: 5, y: 1 }, lateral);
    expect(bottom.y).toBeCloseTo(lateral.side1.y + lateral.side1.height);
    expect(top.y).toBeCloseTo(lateral.side1.y);
  });

  it("mirrors side 2 in lateral mode (baseline on the outer edge)", () => {
    const c2 = locationToSvg({ side: "side_2", x: 1, y: 1 }, lateral);
    expect(c2.y).toBeCloseTo(lateral.side2.y + lateral.side2.height);
    expect(c2.x).toBeCloseTo(lateral.side2.x + lateral.side2.width);
  });
});

describe("isWithinBounds", () => {
  const b = sideBounds(sideWithAllExtensions);

  it("accepts fractional positions inside the enabled extensions", () => {
    expect(isWithinBounds({ side: "side_1", x: 0.5, y: 2.25 }, b)).toBe(true);
    expect(isWithinBounds({ side: "side_2", x: 3, y: 4.5 }, b)).toBe(true);
  });

  it("rejects positions outside the configured bounds", () => {
    expect(isWithinBounds({ side: "side_1", x: 7, y: 2 }, b)).toBe(false);
    expect(isWithinBounds({ side: "side_1", x: 3, y: -0.5 }, b)).toBe(false);
  });

  it("rejects unknown sides", () => {
    const unknown = "side_9" as SideId;
    expect(isWithinBounds({ side: unknown, x: 1, y: 1 }, b)).toBe(false);
  });
});

describe("editorBounds (mirrors Rails' compute_bounds)", () => {
  it("matches sideBounds when no extension is enabled", () => {
    expect(editorBounds(baseSide)).toEqual(sideBounds(baseSide));
    expect(editorBounds(baseSide).side_1).toEqual({
      minX: 1,
      maxX: 5,
      minY: 1,
      maxY: 4,
    });
  });

  it("gates each end of the x-range independently", () => {
    const leftOnly = editorBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, left: true },
    });
    expect(leftOnly.side_1).toEqual({ minX: 0, maxX: 5, minY: 1, maxY: 4 });

    const rightOnly = editorBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, right: true },
    });
    expect(rightOnly.side_1).toEqual({ minX: 1, maxX: 6, minY: 1, maxY: 4 });
  });

  it("deepens y per side with baseline extensions", () => {
    const b = editorBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: true, side_1: true, side_2: true },
    });
    expect(b.side_1).toEqual({ minX: 1, maxX: 5, minY: 0, maxY: 4 });
    expect(b.side_2).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 5 });
  });

  it("ignores the flags when the extended area is disabled", () => {
    const b = editorBounds({
      grid: { columns: 5, rows: 4 },
      extended_area: { enabled: false, left: true, right: true },
    });
    expect(b.side_1).toEqual({ minX: 1, maxX: 5, minY: 1, maxY: 4 });
  });
});

describe("pointToLocation", () => {
  const topDown = buildSideGeometry("top_down", baseSide);
  const lateral = buildSideGeometry("lateral", baseSide);

  it("is the inverse of locationToSvg on both sides and orientations", () => {
    for (const geometry of [topDown, lateral]) {
      for (const side of ["side_1", "side_2"] as const) {
        for (const x of [1, 2.5, 5]) {
          for (const y of [1, 3, 4]) {
            const point = locationToSvg({ side, x, y }, geometry);
            const back = pointToLocation(point, geometry, { snap: null });
            expect(back.side).toBe(side);
            expect(back.x).toBeCloseTo(x, 6);
            expect(back.y).toBeCloseTo(y, 6);
          }
        }
      }
    }
  });

  it("snaps to the nearest grid crossing by default", () => {
    const point = locationToSvg({ side: "side_1", x: 2.6, y: 1.4 }, topDown);
    const back = pointToLocation(point, topDown);
    expect(back.side).toBe("side_1");
    expect(back.x).toBe(3);
    expect(back.y).toBe(1);
  });

  it("clamps a point dragged beyond a side back into the bounds", () => {
    const beyond = {
      x: topDown.side1.x + topDown.side1.width * 3,
      y: topDown.side1.y + topDown.side1.height / 2,
    };
    const back = pointToLocation(beyond, topDown);
    expect(back.side).toBe("side_1");
    expect(back.x).toBe(5);
  });

  it("resolves a point outside both sides to the nearer side", () => {
    const aboveSide2 = {
      x: topDown.side2.x + topDown.side2.width / 2,
      y: topDown.side2.y - 1,
    };
    const back = pointToLocation(aboveSide2, topDown);
    expect(back.side).toBe("side_2");
    expect(back.y).toBe(4);
  });

  it("never dead-ends inside the net gap", () => {
    const net = {
      x: topDown.net.x + topDown.net.width / 2,
      y: topDown.net.y + topDown.net.height / 2,
    };
    expect(["side_1", "side_2"]).toContain(pointToLocation(net, topDown).side);
  });

  it("clamps with the supplied Rails bounds", () => {
    const geometry = buildSideGeometry("top_down", baseSide);
    const farLeft = {
      x: geometry.side1.x - geometry.side1.width * 2,
      y: geometry.side1.y + geometry.side1.height / 2,
    };
    expect(pointToLocation(farLeft, geometry).x).toBe(1);
    expect(
      pointToLocation(farLeft, geometry, {
        bounds: editorBounds({
          grid: { columns: 5, rows: 4 },
          extended_area: { enabled: true, left: true },
        }),
      }).x,
    ).toBe(0);
  });

  it("honours a custom snap step", () => {
    const point = locationToSvg({ side: "side_1", x: 2.4, y: 1.6 }, topDown);
    const back = pointToLocation(point, topDown, { snap: 0.5 });
    expect(back.x).toBe(2.5);
    expect(back.y).toBe(1.5);
  });
});