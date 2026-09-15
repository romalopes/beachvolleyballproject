import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The form loads its lookups on mount; the visual catalog needs no API.
vi.mock("../../../../api", () => {
  class ApiValidationError extends Error {}
  return {
    api: {
      skills: () => Promise.resolve([]),
      categories: () => Promise.resolve([]),
      adminCreateDrill: () => Promise.resolve({}),
      adminUpdateDrill: () => Promise.resolve({}),
    },
    ApiValidationError,
  };
});

import DrillForm from "./DrillForm";
import { SAMPLE_DRILL_DEFINITION } from "../../../drill/definition";
import type { DrillDefinition } from "../../../drill/definition";
import type { Drill } from "../../../../api";

/**
 * The visual builder and the JSON textarea are two views of one model. These
 * tests pin the Phase-1 contract: a visual edit re-derives the JSON ("the JSON
 * on time"), a manual JSON edit rehydrates the model, and a malformed JSON draft
 * never destroys the model the builder is working from.
 */

afterEach(cleanup);

const renderForm = () =>
  render(<DrillForm initial={null} onSuccess={vi.fn()} onCancel={vi.fn()} />);

const jsonField = () => {
  // In JSON mode, the textarea is visible. Switch to it first.
  const jsonTab = screen.getByRole("button", { name: "JSON editor" });
  if (jsonTab && jsonTab.getAttribute("aria-pressed") !== "true") {
    fireEvent.click(jsonTab);
  }
  return screen.getByLabelText("Definition (JSON)") as HTMLTextAreaElement;
};

/** Wait for the mount effects (skills/categories) to flush. */
const ready = () =>
  waitFor(() =>
    expect(screen.getByText(/no participants yet/i)).toBeInTheDocument(),
  );

describe("DrillForm — visual catalog ↔ JSON", () => {
  it("starts a new drill with no definition and an empty catalog", async () => {
    renderForm();
    await ready();

    expect(jsonField().value).toBe("");
    // A brand-new drill is not "missing" a definition — nothing to warn about.
    expect(screen.queryByText(/has no saved definition yet/i)).toBeNull();
  });

  it("writes the JSON as soon as an entity is added visually", async () => {
    renderForm();
    await ready();

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));

    const parsed = JSON.parse(jsonField().value);
    expect(parsed.participants).toEqual([{ id: "P1", type: "player" }]);
    expect(parsed.side.grid).toEqual({ columns: 5, rows: 4 });
    // The lazy bootstrap gives the builder a valid, saveable definition.
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.steps[0].id).toBe("S1");
    expect(parsed.steps[0].participants).toEqual([]);
  });

  it("hydrates the catalog when the JSON is edited manually", async () => {
    renderForm();
    await ready();

    const definition = {
      version: 1,
      side: { grid: { columns: 5, rows: 4 } },
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
      balls: [],
      objects: [],
      steps: [
        {
          id: "S1",
          participants: [],
          balls: [],
          objects: [],
          actions: [],
          participant_movements: [],
          ball_movements: [],
          object_movements: [],
        },
      ],
    };

    fireEvent.change(jsonField(), {
      target: { value: JSON.stringify(definition, null, 2) },
    });

    // Switching back to visual mode rehydrates the model from the edited JSON.
    fireEvent.click(screen.getByRole("button", { name: "Visual builder" }));

    expect(screen.getByLabelText("Type of P9")).toBeInTheDocument();
    expect(screen.getByLabelText("Role of P9")).toHaveValue("feeder");
  });

  it("keeps the last good model when the JSON draft becomes malformed", async () => {
    renderForm();
    await ready();

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();

    fireEvent.change(jsonField(), { target: { value: "{ nope" } });

    // The textarea keeps exactly what the user typed...
    expect(jsonField().value).toBe("{ nope");
    // ...switch back to visual mode, and the builder still works off the last
    // good model.
    fireEvent.click(screen.getByRole("button", { name: "Visual builder" }));
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();
  });
});

/**
 * Existing drills, not just new ones. Rails defaults the `definition` column to
 * `{}` (`null: false`), so the editor receives partial objects from storage and
 * has to render a draft rather than crash indexing `definition.steps`.
 */
const savedDrill = (definition: unknown): Drill =>
  ({
    id: 7,
    title: "Serve receive",
    slug: "serve-receive",
    setup_instructions: "",
    training_stage: "middle",
    difficulty_level: "intermediate",
    min_players: 2,
    max_players: 4,
    ideal_num_players: 4,
    definition,
  }) as Drill;

const renderSaved = (definition: unknown) =>
  render(
    <DrillForm
      initial={savedDrill(definition)}
      onSuccess={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe("DrillForm — stored definitions", () => {
  it("renders the Rails `{}` column default as a draft", async () => {
    renderSaved({});
    await ready();

    // The panes get a complete draft: one empty step on the default side...
    expect(screen.getByLabelText("Step S1")).toBeInTheDocument();
    // ...and the textarea shows that same draft, so the JSON stays "on time".
    const draft = JSON.parse(jsonField().value) as DrillDefinition;
    expect(draft.side).toEqual({ grid: { columns: 5, rows: 4 } });
    expect(draft.steps.map((step) => step.id)).toEqual(["S1"]);
    expect(draft.steps[0].participants).toEqual([]);
  });

  it("keeps the entities of a stored definition that has no steps", async () => {
    renderSaved({
      version: 1,
      side: { grid: { columns: 5, rows: 4 } },
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
      balls: [],
      objects: [],
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Type of P9")).toBeInTheDocument(),
    );

    // The missing step is supplied, so the step controls have something to show.
    expect(screen.getByLabelText("Step S1")).toBeInTheDocument();
    // The author's entity survives the normalisation.
    const draft = JSON.parse(jsonField().value) as DrillDefinition;
    expect(draft.participants).toEqual([
      { id: "P9", type: "coach", role: "feeder" },
    ]);
  });

  it("says out loud that the drill has no saved definition yet", async () => {
    renderSaved({});
    await ready();

    // The empty draft is intentional, so it must not look like lost data.
    expect(
      screen.getByText(/has no saved definition yet/i),
    ).toBeInTheDocument();
  });

  it("stays quiet for a drill that does have a definition", async () => {
    renderSaved(SAMPLE_DRILL_DEFINITION);
    // The textarea is filled once the stored definition has been hydrated.
    await waitFor(() => expect(jsonField().value).not.toBe(""));

    expect(screen.queryByText(/has no saved definition yet/i)).toBeNull();
  });
});