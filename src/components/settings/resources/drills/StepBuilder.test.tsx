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

  it("commits a typed location through setEntityLocation", () => {
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
    const onChange = vi.fn();
    render(
      <StepBuilder
        definition={placed}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Location of P1 x"), {
      target: { value: "4" },
    });
    fireEvent.blur(screen.getByLabelText("Location of P1 x"));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 4,
      y: 1,
    });
  });

  it("routes a movement's from/to edits to the current and next step", () => {
    const definition: DrillDefinition = {
      ...catalogDrill(),
      steps: [
        {
          ...emptyStep("S1"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
          ],
          participant_movements: [
            {
              participant_id: "P1",
              from: { side: "side_1", x: 2, y: 1 },
              to: { side: "side_1", x: 3, y: 1 },
            },
          ],
        },
        {
          ...emptyStep("S2"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 3, y: 1 } },
          ],
        },
      ],
    };
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

    // "from" commits on the current step.
    fireEvent.change(screen.getByLabelText("Edit from of P1 x"), {
      target: { value: "4" },
    });
    fireEvent.blur(screen.getByLabelText("Edit from of P1 x"));
    const fromEdit = onChange.mock.calls[0][0] as DrillDefinition;
    expect(fromEdit.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 4,
      y: 1,
    });
    expect(fromEdit.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 3,
      y: 1,
    });

    // "to" commits on the next step.
    fireEvent.change(screen.getByLabelText("Edit to of P1 (next step) x"), {
      target: { value: "5" },
    });
    fireEvent.blur(screen.getByLabelText("Edit to of P1 (next step) x"));
    const toEdit = onChange.mock.calls[1][0] as DrillDefinition;
    expect(toEdit.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 2,
      y: 1,
    });
    expect(toEdit.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 5,
      y: 1,
    });
  });

  it("edits the authored target on the last step through setMovementTarget", () => {
    const definition: DrillDefinition = {
      ...catalogDrill(),
      balls: [{ id: "B1", type: "volleyball" }],
      steps: [
        {
          ...emptyStep("S1"),
          balls: [
            { id: "B1", active: true, location: { side: "side_1", x: 3, y: 1 } },
          ],
        },
        {
          ...emptyStep("S2"),
          balls: [
            { id: "B1", active: true, location: { side: "side_1", x: 3, y: 1 } },
          ],
          ball_movements: [
            {
              ball_id: "B1",
              from: { side: "side_1", x: 3, y: 1 },
              to: { side: "side_1", x: 4, y: 2 },
              description: "coach feeds",
            },
          ],
        },
      ],
    };
    const onChange = vi.fn();
    render(
      <StepBuilder
        definition={definition}
        stepIndex={1}
        hasNext={false}
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    // The authored destination is the only location qualified as an exit
    // target; the movement's origin still reads as a plain placement.
    const targetLegend = screen
      .getByLabelText("Edit to of B1 (authored) y")
      .closest("fieldset")
      ?.querySelector("legend");
    expect(targetLegend?.textContent).toBe(
      "Edit to of B1 (authored) (exit target)",
    );
    const originLegend = screen
      .getByLabelText("Edit from of B1 x")
      .closest("fieldset")
      ?.querySelector("legend");
    expect(originLegend?.textContent).toBe("Edit from of B1");

    fireEvent.change(screen.getByLabelText("Edit to of B1 (authored) y"), {
      target: { value: "4" },
    });
    fireEvent.blur(screen.getByLabelText("Edit to of B1 (authored) y"));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[1].ball_movements[0].to).toEqual({
      side: "side_1",
      x: 4,
      y: 4,
    });
    expect(next.steps[1].ball_movements[0].description).toBe("coach feeds");
  });

  it("explains a missing arrow and can activate the entity in the next step", () => {
    const definition: DrillDefinition = {
      ...catalogDrill(),
      steps: [
        {
          ...emptyStep("S1"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
          ],
        },
        {
          ...emptyStep("S2"),
          participants: [
            { id: "P1", active: false, location: { side: "side_1", x: 2, y: 1 } },
          ],
        },
      ],
    };
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

    expect(screen.getByText(/No arrow: P1 is inactive in S2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activate P1 in S2" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[1].participants[0].active).toBe(true);
    // Activation in place keeps the location.
    expect(next.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 2,
      y: 1,
    });
  });
});
