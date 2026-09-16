/**
 * CourtSetup — court-shape controls of the visual builder.
 *
 * Grid, extended area and default orientation are written through the pure
 * `setGrid`/`setExtendedArea`/`setViewOrientation` helpers; what this component
 * adds is the interaction contract: valid integers commit on blur/Enter,
 * invalid drafts are rejected, and a bounds change that had to move placements
 * is reported through a `role="status"` note.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import CourtSetup from "./CourtSetup";
import { emptyStep, setEntityLocation } from "./drill-model";

afterEach(cleanup);

/** P1 at (5,4) on side_1 — the corner, so any shrink must clamp it. */
const cornerDrill = (extended = false): DrillDefinition => ({
  version: 1,
  side: {
    grid: { columns: 5, rows: 4 },
    ...(extended ? { extended_area: { enabled: true, left: true } } : {}),
  },
  participants: [{ id: "P1", type: "player" }],
  balls: [],
  objects: [],
  steps: [
    {
      ...emptyStep("S1"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 5, y: 4 } },
      ],
    },
  ],
});

const renderSetup = (definition: DrillDefinition = cornerDrill()) => {
  const onChange = vi.fn();
  const { container } = render(
    <CourtSetup definition={definition} onChange={onChange} />,
  );
  return { onChange, container };
};

const columnsInput = () =>
  screen.getByLabelText("Grid columns") as HTMLInputElement;

describe("CourtSetup", () => {
  it("commits a valid grid change on blur", () => {
    const { onChange } = renderSetup();

    fireEvent.change(columnsInput(), { target: { value: "3" } });
    fireEvent.blur(columnsInput());

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.side.grid).toEqual({ columns: 3, rows: 4 });
  });

  it("commits on Enter and rejects invalid integers", () => {
    const { onChange } = renderSetup();

    fireEvent.change(columnsInput(), { target: { value: "6" } });
    fireEvent.keyDown(columnsInput(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      (onChange.mock.calls[0][0] as DrillDefinition).side.grid.columns,
    ).toBe(6);

    // Zero, fractional and blank drafts are rejected without a commit.
    fireEvent.change(columnsInput(), { target: { value: "0" } });
    fireEvent.blur(columnsInput());
    fireEvent.change(columnsInput(), { target: { value: "2.5" } });
    fireEvent.blur(columnsInput());
    fireEvent.change(columnsInput(), { target: { value: "" } });
    fireEvent.blur(columnsInput());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reports placements that had to move when the court shrinks", () => {
    const first = renderSetup();
    fireEvent.change(columnsInput(), { target: { value: "2" } });
    fireEvent.blur(columnsInput());
    const afterColumns = first.onChange.mock.calls[0][0] as DrillDefinition;
    expect(afterColumns.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 2,
      y: 4,
    });
    cleanup();

    // Re-render with the parent's updated model, as the real form would.
    renderSetup(afterColumns);
    fireEvent.change(screen.getByLabelText("Grid rows"), {
      target: { value: "2" },
    });
    fireEvent.blur(screen.getByLabelText("Grid rows"));

    expect(screen.getByRole("status").textContent).toMatch(
      /1 placement moved inside the new bounds/,
    );
  });

  it("clears the extension flags when the extended area is switched off", () => {
    const { onChange } = renderSetup(cornerDrill(true));

    fireEvent.click(screen.getByLabelText("Extended area"));

    const next = onChange.mock.calls[0][0] as DrillDefinition;
    expect(next.side.extended_area).toEqual({ enabled: false });
    expect(next.side.grid).toEqual({ columns: 5, rows: 4 });
  });

  it("gates the side flags on the extended area being enabled", () => {
    renderSetup();

    const left = screen.getByRole("checkbox", { name: "Left" });
    expect(left).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Extended area"));
    // Re-render through the parent is not wired here, so assert on the first
    // render only: the flags start disabled while `enabled` is false.
    expect(left).toBeDisabled();
  });

  it("writes the default orientation; clearing with none saved is a no-op", () => {
    const { onChange } = renderSetup();

    fireEvent.change(screen.getByLabelText("Default orientation"), {
      target: { value: "top_down" },
    });
    expect((onChange.mock.calls[0][0] as DrillDefinition).view).toEqual({
      orientation: "top_down",
    });

    // The prop still carries no saved view (no parent re-render here), so
    // clearing writes nothing — the helper's identity no-op.
    fireEvent.change(screen.getByLabelText("Default orientation"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("a coordinate change that widens the bounds reports nothing", () => {
    const definition = setEntityLocation(
      cornerDrill(),
      0,
      "participants",
      "P1",
      {
        side: "side_1",
        x: 3,
        y: 2,
      },
    );
    renderSetup(definition);

    fireEvent.change(columnsInput(), { target: { value: "8" } });
    fireEvent.blur(columnsInput());

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("groups the extended-area side flags under the court-setup layout", () => {
    const { container } = renderSetup(cornerDrill(true));

    // The side flags live in their own labelled container (rather than loose in
    // the fieldset) so the shared court-setup layout can treat them as one
    // wrapping group; jsdom applies no stylesheets, so we assert the DOM
    // contract the rules in App.css rely on.
    const flags = container.querySelector(".drill-court-setup-flags");
    expect(flags).not.toBeNull();
    expect(flags!.getAttribute("aria-label")).toBe("Extended area sides");

    const boxes = flags!.querySelectorAll("input[type=checkbox]");
    expect(boxes).toHaveLength(4);
    expect(
      Array.from(flags!.children).every((child) => child.tagName === "LABEL"),
    ).toBe(true);

    // The "Extended area" toggle is a sibling row, so both share the
    // court-setup layout rhythm defined in App.css.
    const toggle = container.querySelector(".drill-court-setup-enabled");
    expect(toggle).not.toBeNull();
    expect(toggle!.parentElement).toBe(flags!.parentElement);
  });
});
