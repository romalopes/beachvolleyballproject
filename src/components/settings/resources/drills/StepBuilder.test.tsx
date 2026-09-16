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

  it("groups each placed element's chip, flag and Remove above its location box", () => {
    const placed: DrillDefinition = {
      ...catalogDrill(),
      participants: [
        { id: "P1", type: "player" },
        { id: "P2", type: "player" },
      ],
      steps: [
        {
          ...emptyStep("S1"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
            { id: "P2", active: true, location: { side: "side_1", x: 3, y: 2 } },
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
        selected={null}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    // The element card's layout is CSS-only, so assert the DOM contract it
    // depends on: chip + "active" + Remove share a header row, that row is a
    // direct child of the element, and the location box sits below it (never
    // inside it) with one element per list item, which is what draws the
    // divider between two configured elements.
    const p1HeaderRow = screen
      .getByRole("button", { name: "Select P1" })
      .closest("li")!;
    const p2Row = screen
      .getByRole("button", { name: "Select P2" })
      .closest("li")!;
    expect(p1HeaderRow.parentElement?.className).toBe("drill-builder-placed");
    expect(p2Row.parentElement).toBe(p1HeaderRow.parentElement);

    const header = p1HeaderRow.querySelector(".drill-builder-placed-head")!;
    expect(header.parentElement).toBe(p1HeaderRow);
    expect(
      header.contains(screen.getByLabelText("Mark P1 as active on this step")),
    ).toBe(true);
    expect(
      header.contains(screen.getByRole("button", { name: "Remove P1 from S1" })),
    ).toBe(true);

    expect(
      p1HeaderRow.querySelector(".drill-location-fields")?.parentElement,
    ).toBe(p1HeaderRow);
    // Each element owns its own header, so the header is never shared.
    expect(p2Row.querySelector(".drill-builder-placed-head")).not.toBe(header);
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

  it("adds an action event to the step, once a participant is chosen", () => {
    const definition: DrillDefinition = {
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
        definition={definition}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    // There is nothing to attach an action to until a participant is picked —
    // the action belongs to an entity that is actually placed on this step.
    const addAction = screen.getByRole("button", { name: "Add action" });
    expect(addAction).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Participant" }), {
      target: { value: "P1" },
    });
    expect(addAction).toBeEnabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "attack" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "down the line" },
    });
    fireEvent.click(addAction);

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].actions).toEqual([
      {
        participant_id: "P1",
        action: { type: "attack", description: "down the line" },
      },
    ]);
    // Adding an action is an addition, not a re-placement.
    expect(next.steps[0].participants).toEqual(definition.steps[0].participants);
    expect(next.steps[1]).toEqual(definition.steps[1]);
  });

  it("removes an action from the step", () => {
    const definition: DrillDefinition = {
      ...catalogDrill(),
      steps: [
        {
          ...emptyStep("S1"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
          ],
          actions: [{ participant_id: "P1", action: { type: "serve" } }],
        },
        emptyStep("S2"),
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

    expect(screen.getByText("P1 — serve")).toBeInTheDocument();
    // The only button whose accessible name is exactly "Remove": the placed
    // entity's own Remove carries an aria-label ("Remove P1 from S1").
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].actions).toEqual([]);
  });

  it("shows one actions group even when several kinds have movements", () => {
    const definition: DrillDefinition = {
      ...catalogDrill(),
      balls: [{ id: "B1", type: "volleyball" }],
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
          balls: [
            { id: "B1", active: true, location: { side: "side_1", x: 3, y: 1 } },
          ],
          ball_movements: [
            {
              ball_id: "B1",
              from: { side: "side_1", x: 3, y: 1 },
              to: { side: "side_1", x: 4, y: 2 },
            },
          ],
        },
        {
          ...emptyStep("S2"),
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 3, y: 1 } },
          ],
          balls: [
            { id: "B1", active: true, location: { side: "side_1", x: 4, y: 2 } },
          ],
        },
      ],
    };
    render(
      <StepBuilder
        definition={definition}
        stepIndex={0}
        hasNext
        selected={null}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    // Two kinds have movements, but "Actions in this step" describes the step:
    // one group, one add-action row — and it is there even without movements.
    expect(screen.getAllByText("Actions in this step")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Add action" }),
    ).toHaveLength(1);
  });

  it("lists a derived ball movement by its endpoints and keeps them when noted", () => {
    const from = { side: "side_1" as const, x: 3, y: 1 };
    const to = { side: "side_1" as const, x: 4, y: 2 };
    const definition: DrillDefinition = {
      ...catalogDrill(),
      balls: [{ id: "B1", type: "volleyball" }],
      steps: [
        {
          ...emptyStep("S1"),
          balls: [{ id: "B1", active: true, location: from }],
          ball_movements: [{ ball_id: "B1", from, to }],
        },
        {
          ...emptyStep("S2"),
          balls: [{ id: "B1", active: true, location: to }],
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

    // The movement reads as from → to, and the note editor adds to it rather
    // than replacing it: { ball_id, from, to, description }.
    expect(screen.getByText(/B1: S1 \(3, 1\) → S1 \(4, 2\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(screen.getByLabelText("Movement note for B1"), {
      target: { value: "P1 sets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps[0].ball_movements).toEqual([
      { ball_id: "B1", from, to, description: "P1 sets" },
    ]);
  });
});
