/**
 * StepList — the step manager of the visual builder. These tests drive the
 * pure `drill-model` helpers through the UI: select, add, duplicate, reorder,
 * remove (with the last-step guard) — each emitted as a new `DrillDefinition`
 * that still satisfies the schema.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import { validateDrillDefinition } from "../../../../services/drillSchema";
import { emptyStep } from "./drill-model";
import StepList from "./StepList";

afterEach(cleanup);

const twoSteps = (): DrillDefinition => ({
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [
    { ...emptyStep("S1"), description: "serve receive" },
    {
      ...emptyStep("S2"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
      ],
    },
  ],
});

describe("StepList", () => {
  it("selects a step", () => {
    const onSelectStep = vi.fn();
    render(
      <StepList
        definition={twoSteps()}
        activeStepIndex={0}
        onSelectStep={onSelectStep}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "S21 placed" }));
    expect(onSelectStep).toHaveBeenCalledWith(1);
  });

  it("adds a step with a fresh id", () => {
    const onChange = vi.fn();
    render(
      <StepList
        definition={twoSteps()}
        activeStepIndex={0}
        onSelectStep={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps.map((step) => step.id)).toEqual(["S1", "S2", "S3"]);
    expect(validateDrillDefinition(next).valid).toBe(true);
  });

  it("duplicates a step with a fresh id and the same placements", () => {
    const onChange = vi.fn();
    render(
      <StepList
        definition={twoSteps()}
        activeStepIndex={0}
        onSelectStep={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Duplicate S2" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps).toHaveLength(3);
    expect(next.steps[2].id).toBe("S3");
    expect(next.steps[2].participants).toEqual(twoSteps().steps[1].participants);
    expect(validateDrillDefinition(next).valid).toBe(true);
  });

  it("reorders steps and re-derives the movements", () => {
    const onChange = vi.fn();
    render(
      <StepList
        definition={twoSteps()}
        activeStepIndex={0}
        onSelectStep={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move S2 up" }));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps.map((step) => step.id)).toEqual(["S2", "S1"]);
    expect(validateDrillDefinition(next).valid).toBe(true);
  });

  it("removes a step but keeps the last one", () => {
    const onChange = vi.fn();
    render(
      <StepList
        definition={twoSteps()}
        activeStepIndex={1}
        onSelectStep={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove S2" }));
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.steps.map((step) => step.id)).toEqual(["S1"]);

    const single: DrillDefinition = {
      ...twoSteps(),
      steps: [emptyStep("S1")],
    };
    cleanup();
    render(
      <StepList
        definition={single}
        activeStepIndex={0}
        onSelectStep={vi.fn()}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove S1" }),
    ).toBeDisabled();
  });
});