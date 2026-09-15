/**
 * StepBuilder — placement tests.
 *
 * The builder edits through the pure `drill-model` helpers; the court lives in
 * the surrounding `DrillDefinitionBuilder` sticky pane, so these tests assert
 * the per-step controls only: palette add → active toggle → remove, plus the
 * movements/actions lists. Court drags are exercised one level up.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import { emptyStep } from "./drill-model";
import StepBuilder from "./StepBuilder";

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
    render(
      <StepBuilder
        definition={catalogDrill()}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add P1" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].participants.map((s) => s.id)).toEqual(["P1"]);
  });

  it("toggles an entity's active flag and removes it from the step", () => {
    const definition = catalogDrill();
    const onChange = vi.fn();
    render(
      <StepBuilder
        definition={definition}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    // Add, then toggle it off, then remove it from the step. Each render is
    // torn down first: the queries below are not scoped to one render.
    fireEvent.click(screen.getByRole("button", { name: "Add P1" }));
    const added = onChange.mock.calls[0][0] as DrillDefinition;
    cleanup();

    render(
      <StepBuilder
        definition={added}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Mark P1 as active on this step"));
    const toggled = onChange.mock.calls[1][0] as DrillDefinition;
    expect(toggled.steps[0].participants[0].active).toBe(false);
    cleanup();

    render(
      <StepBuilder
        definition={added}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove p1/i }));
    const removed = onChange.mock.calls[2][0] as DrillDefinition;
    expect(removed.steps[0].participants).toEqual([]);
  });

  it("highlights the chip matching the selection", () => {
    const placed: DrillDefinition = {
      ...catalogDrill(),
      steps: [
        {
          ...emptyStep("S1"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
          ],
        },
        emptyStep("S2"),
      ],
    };
    render(
      <StepBuilder
        definition={placed}
        stepIndex={0}
        hasNext
        selected={{ kind: "participants", id: "P1" }}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
        const chip = screen.getByRole("button", { name: "Select P1" });
    expect(chip.className).toContain("selected");
  });
});
