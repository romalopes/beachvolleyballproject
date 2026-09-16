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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition, Orientation } from "../../../drill/definition";
import { emptyStep } from "./drill-model";
import DrillDefinitionBuilder from "./DrillDefinitionBuilder";

vi.mock("./InteractiveCourt", () => ({
  __esModule: true,
  default: ({
    definition,
    orientation,
    stepIndex,
    playing = false,
    progress = 0,
    sizeScale = 100,
    onMove,
    onTargetMove,
  }: {
    definition: DrillDefinition;
    orientation: Orientation;
    stepIndex: number;
    playing?: boolean;
    progress?: number;
    sizeScale?: number;
    onMove: (
      kind: "participants" | "balls" | "objects",
      id: string,
      location: { side: "side_1" | "side_2"; x: number; y: number },
      layer: "current" | "next",
    ) => void;
    onTargetMove?: (
      kind: "participants" | "balls" | "objects",
      movementIndex: number,
      location: { side: "side_1" | "side_2"; x: number; y: number },
    ) => void;
  }) => {
    const step = definition.steps[stepIndex];
    return (
      <div
        data-testid="court"
        data-orientation={orientation}
        data-playing={String(playing)}
        data-progress={progress}
        data-size-scale={sizeScale}
      >
        {(definition.steps[stepIndex]?.ball_movements ?? []).map(
          (movement, index) => (
            <button
              key={`target-${movement.ball_id}-${index}`}
              type="button"
              data-testid={`target-${movement.ball_id}`}
              onClick={() =>
                onTargetMove?.(
                  "balls",
                  index,
                  { side: "side_1", x: 2, y: 2 },
                )
              }
            >
              exit target {movement.ball_id}
            </button>
          ),
        )}
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

/**
 * Playback drives requestAnimationFrame. Frames are stubbed out for the whole
 * file so the play/pause assertions stay deterministic — no frame can run
 * between a click and the assertion.
 */
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

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

/**
 * The visualisation carries the same size slider and step controls as the
 * viewer, so an author can check the moves without leaving the editor. The
 * court is mocked here: these tests pin the wiring from the controls to the
 * court and to the shared playback state.
 */
describe("DrillDefinitionBuilder — visualisation controls", () => {
  it("renders the size slider and the step controls beside the court", () => {
    const { container } = renderBuilder();

    expect(screen.getByLabelText("Court size")).toBeInTheDocument();
    expect(container.querySelector(".drill-controls")).not.toBeNull();
    expect(
      screen.getByRole("tablist", { name: "Step timeline" }),
    ).toBeInTheDocument();
  });

  it("drives the court size from the slider", () => {
    renderBuilder();

    fireEvent.change(screen.getByLabelText("Court size"), {
      target: { value: "120" },
    });

    expect(screen.getByTestId("court").dataset.sizeScale).toBe("120");
    expect(screen.getByText("120%")).toBeInTheDocument();
  });

  it("moves the edit cursor from the step timeline", () => {
    renderBuilder();

    expect(screen.getByRole("tab", { name: "Step 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Step 2" }));

    expect(screen.getByRole("tab", { name: "Step 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Step 1" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("moves the edit cursor with prev/next", () => {
    renderBuilder();

    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByRole("tab", { name: "Step 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous step" }),
    ).not.toBeDisabled();
  });

  it("starts and pauses playback from the controls", () => {
    renderBuilder();

    expect(screen.getByTestId("court").dataset.playing).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(screen.getByTestId("court").dataset.playing).toBe("true");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByTestId("court").dataset.playing).toBe("false");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("commits a dragged last-step exit target through setMovementTarget", () => {
    const base = twoSteps();
    const definition: DrillDefinition = {
      ...base,
      balls: [{ id: "B1", type: "volleyball" }],
      steps: [
        base.steps[0],
        {
          ...base.steps[1],
          balls: [
            { id: "B1", active: true, location: { side: "side_1", x: 2, y: 2 } },
          ],
          ball_movements: [
            {
              ball_id: "B1",
              from: { side: "side_1", x: 2, y: 2 },
              to: { side: "side_1", x: 4, y: 2 },
              description: "coach feeds",
            },
          ],
        },
      ],
    };
    const { onChange } = renderBuilder(definition);

    // The exit cap only exists on the last step.
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByTestId("target-B1"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[1].ball_movements[0].to).toEqual({
      side: "side_1",
      x: 2,
      y: 2,
    });
    expect(next.steps[1].ball_movements[0].description).toBe("coach feeds");
  });
});
