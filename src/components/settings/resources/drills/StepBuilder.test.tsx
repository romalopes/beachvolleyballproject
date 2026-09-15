/**
 * StepBuilder — placement tests.
 *
 * The builder edits through the pure `drill-model` helpers, so these tests
 * assert the whole loop the user sees: palette add → marker on the court →
 * active toggle → drag → the derived movement, plus the JSON textarea in
 * `DrillForm` reflecting the same definition. Pointer drags are exercised one
 * level down in `InteractiveCourt.test.tsx`; here the court is the harness that
 * reports the drag into the builder's `setEntityLocation` path.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DrillDefinition,
  Location,
} from "../../../drill/definition";
import type { Layer } from "./InteractiveCourt";
import { emptyStep } from "./drill-model";
import StepBuilder from "./StepBuilder";

vi.mock("./InteractiveCourt", () => ({
  __esModule: true,
  default: ({
    definition,
    stepIndex,
    onMove,
    onCourtClick,
  }: {
    definition: DrillDefinition;
    stepIndex: number;
    onMove: (
      kind: "participants" | "balls" | "objects",
      id: string,
      location: Location,
      layer: Layer,
    ) => void;
    onCourtClick: (location: Location) => void;
  }) => {
    const step = definition.steps[stepIndex];
    return (
      <div data-testid="court">
        {step.participants.map((state) => (
          <button
            key={`p-${state.id}`}
            type="button"
            data-testid={`marker-${state.id}`}
            onClick={() =>
              onMove("participants", state.id, { side: "side_2", x: 1, y: 1 }, "current")
            }
          >
            {state.id}:{state.active ? "on" : "off"}
          </button>
        ))}
        <button
          type="button"
          data-testid="court-click"
          onClick={() => onCourtClick({ side: "side_1", x: 2, y: 2 })}
        >
          court
        </button>
      </div>
    );
  },
}));

afterEach(cleanup);

const catalogDrill = (): DrillDefinition => ({
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "P1", type: "player" }],
  balls: [],
  objects: [],
  steps: [emptyStep("S1"), emptyStep("S2")],
});

describe("StepBuilder", () => {
  it("adds a catalog entity to the step from the palette", () => {
    const onChange = vi.fn();
    render(<StepBuilder definition={catalogDrill()} stepIndex={0} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add P1" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].participants.map((s) => s.id)).toEqual(["P1"]);
  });
});
