import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CourtConfig } from "./definition";
import DrillCourt from "./DrillCourt";

const baseCourt: CourtConfig = { grid: { columns: 5, rows: 4 } };

const extendedCourt: CourtConfig = {
  grid: { columns: 5, rows: 4 },
  extended_area: { enabled: true, left: true, court_2: true },
};

const viewBoxOf = (container: HTMLElement) => {
  const svg = container.querySelector("svg.drill-court-svg")!;
  const [, , w, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  return { w, h };
};

afterEach(cleanup);

describe("DrillCourt — structure", () => {
  it("renders two labelled court boundaries and a net", () => {
    const { container } = render(
      <DrillCourt orientation="lateral" court={baseCourt} />,
    );
    expect(screen.getByText("SIDE 1")).toBeInTheDocument();
    expect(screen.getByText("SIDE 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".drill-court-boundary")).toHaveLength(2);
    expect(container.querySelectorAll(".drill-net")).toHaveLength(1);
  });

  it("draws the 5x4 reference grid as thin lines, not boxes", () => {
    const { container } = render(
      <DrillCourt orientation="top_down" court={baseCourt} />,
    );
    // 5 column lines + 4 row lines per court, 2 courts = 18 <line> elements.
    expect(container.querySelectorAll(".drill-grid-line")).toHaveLength(18);
    expect(container.querySelectorAll(".drill-grid-line rect")).toHaveLength(0);
  });

  it("marks the middle of the net with a center mark", () => {
    const { container } = render(
      <DrillCourt orientation="top_down" court={baseCourt} />,
    );
    expect(container.querySelectorAll(".drill-net")).toHaveLength(1);
    expect(container.querySelectorAll(".drill-net-center")).toHaveLength(1);
  });

  it("renders extended areas only when enabled", () => {
    const plain = render(<DrillCourt orientation="top_down" court={baseCourt} />);
    expect(plain.container.querySelectorAll(".drill-extended-area")).toHaveLength(
      0,
    );
    plain.unmount();

    const extended = render(
      <DrillCourt orientation="top_down" court={extendedCourt} />,
    );
    expect(
      extended.container.querySelectorAll(".drill-extended-area"),
    ).toHaveLength(2);
  });
});

describe("DrillCourt — orientation", () => {
  it("is taller than wide in top_down and wider than tall in lateral", () => {
    const topDown = render(<DrillCourt orientation="top_down" court={baseCourt} />);
    const td = viewBoxOf(topDown.container);
    expect(td.h).toBeGreaterThan(td.w);
    topDown.unmount();

    const lateral = render(<DrillCourt orientation="lateral" court={baseCourt} />);
    const lat = viewBoxOf(lateral.container);
    expect(lat.w).toBeGreaterThan(lat.h);
  });

  it("keeps the courts square in both orientations", () => {
    for (const orientation of ["top_down", "lateral"] as const) {
      const { container, unmount } = render(
        <DrillCourt orientation={orientation} court={baseCourt} />,
      );
      const rects = container.querySelectorAll<SVGRectElement>(
        ".drill-court-boundary",
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