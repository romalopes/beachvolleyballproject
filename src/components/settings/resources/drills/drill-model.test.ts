import { describe, expect, it } from "vitest";
import { SAMPLE_DRILL_DEFINITION } from "../../../drill/definition";
import type { DrillDefinition } from "../../../drill/definition";
import { validateDrillDefinition } from "../../../../services/drillSchema";
import {
  EMPTY_DEFINITION,
  definitionToJsonText,
  emptyStep,
  isEntityReferenced,
  jsonTextToDefinition,
  newEntityId,
  nextEntityId,
  referencingStepIds,
  renameEntityId,
} from "./drill-model";

/**
 * The drill editor keeps a `DrillDefinition` model and a JSON textarea pointing
 * at the same definition. These helpers are the only bridge between the two, so
 * the contract they must uphold is round-trip fidelity: whatever the user sees
 * as JSON must parse back into the same model the viewer renders.
 */

describe("definitionToJsonText", () => {
  it("pretty-prints the definition with two-space indentation", () => {
    expect(definitionToJsonText(SAMPLE_DRILL_DEFINITION)).toBe(
      JSON.stringify(SAMPLE_DRILL_DEFINITION, null, 2),
    );
  });
});

describe("jsonTextToDefinition", () => {
  it("returns null for blank and whitespace-only text", () => {
    expect(jsonTextToDefinition("")).toBeNull();
    expect(jsonTextToDefinition("   \n\t ")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(jsonTextToDefinition("{ nope")).toBeNull();
  });

  it("returns null for non-object JSON (arrays and primitives)", () => {
    expect(jsonTextToDefinition("[1, 2]")).toBeNull();
    expect(jsonTextToDefinition("42")).toBeNull();
    expect(jsonTextToDefinition("null")).toBeNull();
  });

  it("parses a JSON object", () => {
    expect(jsonTextToDefinition('{ "version": 1 }')).toEqual({ version: 1 });
  });

  it("ignores surrounding whitespace", () => {
    expect(jsonTextToDefinition('  \n { "version": 1 } \n ')).toEqual({
      version: 1,
    });
  });
});

describe("definition ↔ JSON text round-trip", () => {
  it("reconstructs the model from its serialised form", () => {
    const text = definitionToJsonText(SAMPLE_DRILL_DEFINITION);
    expect(jsonTextToDefinition(text)).toEqual(SAMPLE_DRILL_DEFINITION);
  });

  it("is idempotent across repeated rounds", () => {
    const once = definitionToJsonText(SAMPLE_DRILL_DEFINITION);
    const twice = definitionToJsonText(jsonTextToDefinition(once)!);
    expect(twice).toBe(once);
  });
});

describe("EMPTY_DEFINITION", () => {
  it("satisfies the shared v1 schema", () => {
    const result = validateDrillDefinition(EMPTY_DEFINITION);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("starts from a single empty step carrying every movement array", () => {
    expect(EMPTY_DEFINITION.steps).toEqual([emptyStep("S1")]);
  });
});

describe("newEntityId / nextEntityId", () => {
  it("returns the first free number for the prefix", () => {
    expect(newEntityId([], "P")).toBe("P1");
    expect(newEntityId(["P1"], "P")).toBe("P2");
    expect(newEntityId(["P1", "P3"], "P")).toBe("P2");
  });

  it("treats existing ids case-insensitively", () => {
    expect(newEntityId(["p1", "P2"], "P")).toBe("P3");
  });

  it("uses the prefix for the requested kind", () => {
    const definition: DrillDefinition = {
      ...EMPTY_DEFINITION,
      balls: [{ id: "B1", type: "volleyball" }],
    };
    expect(nextEntityId(definition, "participants")).toBe("P1");
    expect(nextEntityId(definition, "balls")).toBe("B2");
    expect(nextEntityId(definition, "objects")).toBe("O1");
  });
});

/** A definition where every entity is referenced by step S1 in a different way. */
const referenced: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [
    { id: "P1", type: "player" },
    { id: "P2", type: "player" },
  ],
  balls: [{ id: "B1", type: "volleyball" }],
  objects: [{ id: "O1", type: "cone" }],
  steps: [
    {
      id: "S1",
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
      ],
      balls: [{ id: "B1", active: true }],
      objects: [{ id: "O1", active: false }],
      actions: [{ participant_id: "P1", action: { type: "serve" } }],
      participant_movements: [
        { participant_id: "P2", to: { side: "side_1", x: 2, y: 2 } },
      ],
      ball_movements: [{ ball_id: "B1", to: { side: "side_2", x: 1, y: 1 } }],
      object_movements: [
        { object_id: "O1", to: { side: "side_2", x: 2, y: 2 } },
      ],
    },
  ],
};

describe("referencingStepIds / isEntityReferenced", () => {
  it("finds references from entity state, actions and movements", () => {
    expect(referencingStepIds(referenced, "participants", "P1")).toEqual(["S1"]);
    expect(referencingStepIds(referenced, "participants", "P2")).toEqual(["S1"]);
    expect(referencingStepIds(referenced, "balls", "B1")).toEqual(["S1"]);
    expect(referencingStepIds(referenced, "objects", "O1")).toEqual(["S1"]);
  });

  it("reports an unused entity as unreferenced", () => {
    expect(referencingStepIds(referenced, "participants", "P9")).toEqual([]);
    expect(isEntityReferenced(referenced, "participants", "P9")).toBe(false);
    expect(isEntityReferenced(referenced, "participants", "P1")).toBe(true);
  });
});

describe("renameEntityId", () => {
  it("cascades a participant rename into state, actions and movements", () => {
    const next = renameEntityId(referenced, "participants", "P1", "PLAYER1");
    expect(next.participants.map((p) => p.id)).toEqual(["PLAYER1", "P2"]);
    expect(next.steps[0].participants[0].id).toBe("PLAYER1");
    expect(next.steps[0].actions[0].participant_id).toBe("PLAYER1");
    // Other participants' movements are untouched.
    expect(next.steps[0].participant_movements[0].participant_id).toBe("P2");
  });

  it("cascades a ball rename into state and ball movements", () => {
    const next = renameEntityId(referenced, "balls", "B1", "BALL");
    expect(next.balls[0].id).toBe("BALL");
    expect(next.steps[0].balls[0].id).toBe("BALL");
    expect(next.steps[0].ball_movements[0].ball_id).toBe("BALL");
  });

  it("cascades an object rename into state and object movements", () => {
    const next = renameEntityId(referenced, "objects", "O1", "CONE");
    expect(next.objects[0].id).toBe("CONE");
    expect(next.steps[0].objects[0].id).toBe("CONE");
    expect(next.steps[0].object_movements[0].object_id).toBe("CONE");
  });

  it("is a no-op when the id is unchanged", () => {
    expect(renameEntityId(referenced, "participants", "P1", "P1")).toBe(
      referenced,
    );
  });

  it("keeps the renamed definition schema-valid", () => {
    const next = renameEntityId(referenced, "participants", "P1", "PLAYER1");
    expect(validateDrillDefinition(next).valid).toBe(true);
  });
});