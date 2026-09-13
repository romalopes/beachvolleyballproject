import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  court: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [emptyStep],
};

afterEach(cleanup);

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

  it("re-renders the court geometry when the orientation changes", () => {
    const { container } = render(<DrillViewer definition={definition} />);
    const courtSvg = container.querySelector("svg.drill-court-svg")!;
    const lateralBox = courtSvg.getAttribute("viewBox")!;

    fireEvent.click(screen.getByRole("button", { name: "Top down" }));
    const topDownBox = courtSvg.getAttribute("viewBox")!;

    expect(topDownBox).not.toBe(lateralBox);
  });

  it("renders the definition description above the court", () => {
    const { container } = render(
      <DrillViewer
        definition={{ ...definition, description: "Short drill summary." }}
      />
    );
    const desc = container.querySelector(".drill-definition-description")!;
    expect(desc.textContent).toBe("Short drill summary.");
    // "Above the court": the description node must precede the court canvas.
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