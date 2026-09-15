/**
 * DrillDefinitionBuilder — the sticky-court layout.
 *
 * The court is mocked (its pointer mechanics are covered by
 * `InteractiveCourt.test.tsx`); here the mock is the harness that drives the
 * builder's wiring: drags commit through `setEntityLocation` so the JSON text
 * stays live, the orientation toggle re-renders the court, step selection
 * flows to both the court and the step controls, and the JSON editor shares
 * the scrolling config pane.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition, Orientation } from "../../../drill/definition";
import { emptyStep } from "./drill-model";
import DrillDefinitionBuilder from "./DrillDefinitionBuilder";

vi.mock("./InteractiveCourt", () => ({
  __esModule: true,
  default: ({
    definition,
    orientation,
    stepIndex,
    onMove,
  }: {
    definition: DrillDefinition;
    orientation: Orientation;
    stepIndex: number;
    onMove: (
      kind: "participants" | "balls" | "objects",
      id: string,
      location: { side: "side_1" | "side_2"; x: number; y: number },
      layer: "current" | "next",
    ) => void;
  }) => {
    const step = definition.steps[stepIndex];
    return (
      <div data-testid="court" data-orientation={orientation}>
        {step?.participants.map((state) => (
          <button
            key={`p-${state.id}`}
            type="button"
            data-testid={`marker-${state.id}`}
            onClick={() =>
              onMove(
                "participants",
                state.id,
                { side: "side_1", x: 4, y: 3 },
                "current",
              )
            }
          >
            {state.id}:{state.active ? "on" : "off"}
          </button>
        ))}
        {definition.steps[stepIndex + 1]?.participants.map((state) => (
          <button
            key={`ghost-${state.id}`}
            type="button"
            data-testid={`ghost-${state.id}`}
            onClick={() =>
              onMove(
                "participants",
                state.id,
                { side: "side_1", x: 5, y: 4 },
                "next",
              )
            }
          >
            ghost {state.id}
          </button>
        ))}
      </div>
    );
  },
}));

afterEach(cleanup);

const twoSteps = (): DrillDefinition => ({
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "P1", type: "player" }],
  balls: [],
  objects: [],
  steps: [
    {
      ...emptyStep("S1"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
      ],
    },
    {
      ...emptyStep("S2"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 2, y: 2 } },
      ],
    },
  ],
});

/**
 * P1 placed on S1 only, so switching to S2 has to clear the court. `twoSteps()`
 * deliberately keeps P1 on both steps for the ghost-drag tests.
 */
const firstStepOnly = (): DrillDefinition => {
  const base = twoSteps();
  return { ...base, steps: [base.steps[0], emptyStep("S2")] };
};

const renderBuilder = (definition: DrillDefinition = twoSteps()) => {
  const onChange = vi.fn();
  const utils = render(
    <DrillDefinitionBuilder
      definition={definition}
      onChange={onChange}
    />,
  );
  return { ...utils, onChange };
};

describe("DrillDefinitionBuilder", () => {
  it("renders the sticky court, the step controls", () => {
    renderBuilder();

    expect(screen.getByTestId("court")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Steps" })).toBeInTheDocument();
  });

  it("switches the court orientation from the toggle", () => {
    renderBuilder();

    expect(screen.getByTestId("court").dataset.orientation).toBe("lateral");
    fireEvent.click(screen.getByRole("button", { name: "Top down" }));
    expect(screen.getByTestId("court").dataset.orientation).toBe("top_down");
    fireEvent.click(screen.getByRole("button", { name: "Lateral" }));
    expect(screen.getByTestId("court").dataset.orientation).toBe("lateral");
  });

  it("commits a drag on the current step through setEntityLocation", () => {
    const { onChange } = renderBuilder();

    fireEvent.click(screen.getByTestId("marker-P1"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 4,
      y: 3,
    });
    // The next step is untouched by a current-layer drag.
    expect(next.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 2,
      y: 2,
    });
  });

  it("commits a drag on the next step's ghost to the following step", () => {
    const { onChange } = renderBuilder();

    fireEvent.click(screen.getByTestId("ghost-P1"));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 5,
      y: 4,
    });
    expect(next.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 1,
      y: 1,
    });
  });

  it("shows the selected step's entities on the court after switching steps", () => {
    renderBuilder(firstStepOnly());

    expect(screen.getByTestId("marker-P1")).toBeInTheDocument();

    // S2 has nothing placed, so its court is empty.
    fireEvent.click(screen.getByRole("button", { name: "S20 placed" }));

    expect(screen.queryByTestId("marker-P1")).toBeNull();
  });
});