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

/**
 * The visual builder and the JSON textarea are two views of one model. These
 * tests pin the Phase-1 contract: a visual edit re-derives the JSON ("the JSON
 * on time"), a manual JSON edit rehydrates the model, and a malformed JSON draft
 * never destroys the model the builder is working from.
 */

afterEach(cleanup);

const renderForm = () =>
  render(<DrillForm initial={null} onSuccess={vi.fn()} onCancel={vi.fn()} />);

const jsonField = () =>
  screen.getByLabelText("Definition (JSON)") as HTMLTextAreaElement;

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
    // ...and the builder still works off the last good model.
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();
  });
});