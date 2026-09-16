import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "./definition";
import DrillViewer from "./DrillViewer";

const emptyStep = {
  id: "S1",
  participants: [],
  balls: [],
  objects: [],
  actions: [],
  participant_movements: [],
  ball_movements: [],
  object_movements: [],
};

const definition: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [emptyStep],
};

afterEach(cleanup);

// Playback drives requestAnimationFrame; stubbing it keeps the play/pause
// assertions deterministic (no frame can run between click and assertion).
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DrillViewer — orientation toggle", () => {
  it("starts in the default orientation (lateral) and toggles on click", () => {
    const { container } = render(<DrillViewer definition={definition} />);
    const canvas = container.querySelector(".drill-canvas")!;
    expect(canvas.getAttribute("data-orientation")).toBe("lateral");

    fireEvent.click(screen.getByRole("button", { name: "Top down" }));
    expect(canvas.getAttribute("data-orientation")).toBe("top_down");

    fireEvent.click(screen.getByRole("button", { name: "Lateral" }));
    expect(canvas.getAttribute("data-orientation")).toBe("lateral");
  });

  it("re-renders the side geometry when the orientation changes", () => {
    const { container } = render(<DrillViewer definition={definition} />);
    const sideSvg = container.querySelector("svg.drill-side-svg")!;
    const lateralBox = sideSvg.getAttribute("viewBox")!;

    fireEvent.click(screen.getByRole("button", { name: "Top down" }));
    const topDownBox = sideSvg.getAttribute("viewBox")!;

    expect(topDownBox).not.toBe(lateralBox);
  });

  it("renders the definition description above the side", () => {
    const { container } = render(
      <DrillViewer
        definition={{ ...definition, description: "Short drill summary." }}
      />
    );
    const desc = container.querySelector(".drill-definition-description")!;
    expect(desc.textContent).toBe("Short drill summary.");
    // "Above the side": the description node must precede the side canvas.
    const canvas = container.querySelector(".drill-canvas")!;
    expect(
      desc.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders no description element when the definition has none", () => {
    const { container } = render(<DrillViewer definition={definition} />);
    expect(
      container.querySelector(".drill-definition-description")
    ).toBeNull();
  });
});

describe("DrillViewer — playback controls", () => {
  it("plays and pauses from the shared step controls", () => {
    render(<DrillViewer definition={definition} />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});