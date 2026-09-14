import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SideConfig } from "./definition";
import DrillSide from "./DrillSide";

const baseSide: SideConfig = { grid: { columns: 5, rows: 4 } };

const extendedSide: SideConfig = {
  grid: { columns: 5, rows: 4 },
  extended_area: { enabled: true, left: true, side_2: true },
};

const viewBoxOf = (container: HTMLElement) => {
  const svg = container.querySelector("svg.drill-side-svg")!;
  const [, , w, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  return { w, h };
};

afterEach(cleanup);

describe("DrillSide — structure", () => {
  it("renders two labelled side boundaries and a net", () => {
    const { container } = render(
      <DrillSide orientation="lateral" side={baseSide} />,
    );
    expect(screen.getByText("SIDE 1")).toBeInTheDocument();
    expect(screen.getByText("SIDE 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".drill-side-boundary")).toHaveLength(2);
    expect(container.querySelectorAll(".drill-net")).toHaveLength(1);
  });

  it("draws the 5x4 reference grid as thin lines, not boxes", () => {
    const { container } = render(
      <DrillSide orientation="top_down" side={baseSide} />,
    );
    // 5 column lines + 4 row lines per side, 2 sides = 18 <line> elements.
    expect(container.querySelectorAll(".drill-grid-line")).toHaveLength(18);
    expect(container.querySelectorAll(".drill-grid-line rect")).toHaveLength(0);
  });

  it("marks the middle of the net with a center mark", () => {
    const { container } = render(
      <DrillSide orientation="top_down" side={baseSide} />,
    );
    expect(container.querySelectorAll(".drill-net")).toHaveLength(1);
    expect(container.querySelectorAll(".drill-net-center")).toHaveLength(1);
  });

  it("renders extended areas only when enabled", () => {
    const plain = render(<DrillSide orientation="top_down" side={baseSide} />);
    expect(plain.container.querySelectorAll(".drill-extended-area")).toHaveLength(
      0,
    );
    plain.unmount();

    const extended = render(
      <DrillSide orientation="top_down" side={extendedSide} />,
    );
    expect(
      extended.container.querySelectorAll(".drill-extended-area"),
    ).toHaveLength(2);
  });
});

describe("DrillSide — orientation", () => {
  it("is taller than wide in top_down and wider than tall in lateral", () => {
    const topDown = render(<DrillSide orientation="top_down" side={baseSide} />);
    const td = viewBoxOf(topDown.container);
    expect(td.h).toBeGreaterThan(td.w);
    topDown.unmount();

    const lateral = render(<DrillSide orientation="lateral" side={baseSide} />);
    const lat = viewBoxOf(lateral.container);
    expect(lat.w).toBeGreaterThan(lat.h);
  });

  it("keeps the sides square in both orientations", () => {
    for (const orientation of ["top_down", "lateral"] as const) {
      const { container, unmount } = render(
        <DrillSide orientation={orientation} side={baseSide} />,
      );
      const rects = container.querySelectorAll<SVGRectElement>(
        ".drill-side-boundary",
      );
      expect(rects).toHaveLength(2);
      for (const rect of rects) {
        expect(Number(rect.getAttribute("width"))).toBe(
          Number(rect.getAttribute("height")),
        );
      }
      unmount();
    }
  });
});