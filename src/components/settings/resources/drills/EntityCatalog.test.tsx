import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import EntityCatalog from "./EntityCatalog";
import { emptyStep } from "./drill-model";

/**
 * EntityCatalog owns the drill's roster. These tests pin the contract the
 * visual builder depends on: generated ids are valid and unique, edits emit
 * whole definitions immutably, renames cascade into the steps, and an entity a
 * step still uses cannot be removed.
 */

const base = (): DrillDefinition => ({
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [emptyStep("S1")],
});

/** Definition emitted by the most recent onChange call. */
const lastEmitted = (onChange: ReturnType<typeof vi.fn>): DrillDefinition =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0] as DrillDefinition;

const referencingP1 = (): DrillDefinition => ({
  ...base(),
  participants: [{ id: "P1", type: "player" }],
  steps: [
    {
      ...emptyStep("S1"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
      ],
    },
  ],
});

afterEach(cleanup);

describe("EntityCatalog — adding", () => {
  it("adds a participant with a generated id and the default type", () => {
    const onChange = vi.fn();
    render(<EntityCatalog definition={base()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));

    expect(lastEmitted(onChange).participants).toEqual([
      { id: "P1", type: "player" },
    ]);
  });

  it("adds balls and objects with their own id prefixes", () => {
    const onChange = vi.fn();
    render(<EntityCatalog definition={base()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /balls/i }));
    fireEvent.click(screen.getByRole("button", { name: /add ball/i }));
    expect(lastEmitted(onChange).balls).toEqual([
      { id: "B1", type: "volleyball" },
    ]);

    fireEvent.click(screen.getByRole("tab", { name: /objects/i }));
    fireEvent.click(screen.getByRole("button", { name: /add object/i }));
    expect(lastEmitted(onChange).objects).toEqual([{ id: "O1", type: "cone" }]);
  });

  it("shows the per-kind counts on the tabs", () => {
    render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [{ id: "P1", type: "player" }],
          balls: [{ id: "B1", type: "volleyball" }],
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: /participants/i })).toHaveTextContent(
      "1",
    );
    expect(screen.getByRole("tab", { name: /balls/i })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /objects/i })).toHaveTextContent("0");
  });
});

describe("EntityCatalog — editing", () => {
  it("changes an entity's type through the select", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [{ id: "P1", type: "player" }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Type of P1"), {
      target: { value: "coach" },
    });

    expect(lastEmitted(onChange).participants).toEqual([
      { id: "P1", type: "coach" },
    ]);
  });

  it("edits role and description", () => {
    const onChange = vi.fn();
    // The catalog is controlled: feed each emitted definition back in, exactly
    // as DrillForm does, so successive edits compose.
    const { rerender } = render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [{ id: "P1", type: "player" }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Role of P1"), {
      target: { value: "setter" },
    });
    const withRole = lastEmitted(onChange);
    expect(withRole.participants).toEqual([
      { id: "P1", type: "player", role: "setter" },
    ]);

    rerender(<EntityCatalog definition={withRole} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Description of P1"), {
      target: { value: "Sets for P2." },
    });
    expect(lastEmitted(onChange).participants[0]).toEqual({
      id: "P1",
      type: "player",
      role: "setter",
      description: "Sets for P2.",
    });
  });

  it("offers no role field for balls", () => {
    render(
      <EntityCatalog
        definition={{
          ...base(),
          balls: [{ id: "B1", type: "volleyball" }],
        }}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /balls/i }));

    expect(screen.getByLabelText("Description of B1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Role of B1")).not.toBeInTheDocument();
  });
});

describe("EntityCatalog — renaming", () => {
  it("cascades a rename into the steps", () => {
    const onChange = vi.fn();
    render(<EntityCatalog definition={referencingP1()} onChange={onChange} />);

    const idInput = screen.getByLabelText("Id of P1");
    fireEvent.change(idInput, { target: { value: "PLAYER" } });
    fireEvent.blur(idInput);

    const next = lastEmitted(onChange);
    expect(next.participants[0].id).toBe("PLAYER");
    expect(next.steps[0].participants[0].id).toBe("PLAYER");
  });

  it("rejects a duplicate id and keeps the committed one", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [
            { id: "P1", type: "player" },
            { id: "P2", type: "player" },
          ],
        }}
        onChange={onChange}
      />,
    );

    const idInput = screen.getByLabelText("Id of P1");
    fireEvent.change(idInput, { target: { value: "p2" } });
    fireEvent.blur(idInput);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/"p2" is already used\./)).toBeInTheDocument();
    expect(idInput).toHaveValue("P1");
  });

  it("rejects an empty id", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [{ id: "P1", type: "player" }],
        }}
        onChange={onChange}
      />,
    );

    const idInput = screen.getByLabelText("Id of P1");
    fireEvent.change(idInput, { target: { value: "   " } });
    fireEvent.blur(idInput);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Id cannot be empty.")).toBeInTheDocument();
  });
});

describe("EntityCatalog — removing", () => {
  it("removes an unreferenced entity", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{
          ...base(),
          participants: [{ id: "P1", type: "player" }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove P1" }));

    expect(lastEmitted(onChange).participants).toEqual([]);
  });

  it("refuses to remove a referenced entity and warns with the step id", () => {
    const onChange = vi.fn();
    render(<EntityCatalog definition={referencingP1()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove P1" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot remove P1");
    expect(screen.getByRole("alert")).toHaveTextContent("S1");
  });

  it("marks a referenced entity as in use", () => {
    render(<EntityCatalog definition={referencingP1()} onChange={vi.fn()} />);
    expect(screen.getByText("in use")).toBeInTheDocument();
  });

  it("removes an unreferenced ball", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{ ...base(), balls: [{ id: "B1", type: "volleyball" }] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /balls/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove B1" }));

    expect(lastEmitted(onChange).balls).toEqual([]);
  });

  it("refuses to remove a ball a step still places", () => {
    const onChange = vi.fn();
    render(
      <EntityCatalog
        definition={{
          ...base(),
          balls: [{ id: "B1", type: "volleyball" }],
          steps: [
            {
              ...emptyStep("S1"),
              balls: [
                {
                  id: "B1",
                  active: true,
                  location: { side: "side_1", x: 1, y: 1 },
                },
              ],
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /balls/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove B1" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot remove B1");
    expect(screen.getByRole("alert")).toHaveTextContent("S1");
  });
});