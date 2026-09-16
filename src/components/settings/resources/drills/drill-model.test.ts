import { describe, expect, it } from "vitest";
import { SAMPLE_DRILL_DEFINITION } from "../../../drill/definition";
import type { DrillDefinition } from "../../../drill/definition";
import { validateDrillDefinition } from "../../../../services/drillSchema";
import {
  EMPTY_DEFINITION,
  activeLocations,
  addActionToStep,
  addEntityToStep,
  defaultStepLocation,
  definitionToJsonText,
  emptyStep,
  isEntityReferenced,
  jsonTextToDefinition,
  newEntityId,
  nextEntityId,
  normalizeDefinition,
  referencingStepIds,
  removeActionFromStep,
  removeEntityFromStep,
  removeMovement,
  renameEntityId,
  sameLocation,
  setEntityActive,
  setEntityLocation,
  setMovementDescription,
  syncMovements,
  syncMovementsAt,
  clampDefinitionToBounds,
  duplicateStep,
  setExtendedArea,
  setGrid,
  setMovementTarget,
  setViewOrientation,
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

describe("normalizeDefinition", () => {
  it("completes the Rails `{}` column default into a renderable draft", () => {
    const draft = normalizeDefinition({});

    expect(draft).toEqual(EMPTY_DEFINITION);
    expect(validateDrillDefinition(draft).valid).toBe(true);
  });

  it("turns anything unreadable into that same draft", () => {
    for (const value of [null, undefined, 42, "nope", true, [1, 2]]) {
      expect(normalizeDefinition(value)).toEqual(EMPTY_DEFINITION);
    }
  });

  it("is a no-op for a definition that already satisfies the schema", () => {
    expect(normalizeDefinition(SAMPLE_DRILL_DEFINITION)).toEqual(
      SAMPLE_DRILL_DEFINITION,
    );
  });

  it("does not mutate the value it normalises", () => {
    const partial = {
      version: 1,
      participants: [{ id: "P1", type: "player" }],
    };

    normalizeDefinition(partial);

    expect(partial).toEqual({
      version: 1,
      participants: [{ id: "P1", type: "player" }],
    });
  });

  it("keeps the entities while supplying the missing steps", () => {
    const draft = normalizeDefinition({
      version: 1,
      side: { grid: { columns: 5, rows: 4 } },
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
    });

    expect(draft.participants).toEqual([
      { id: "P9", type: "coach", role: "feeder" },
    ]);
    expect(draft.steps).toEqual([emptyStep("S1")]);
    // The reference helper the catalog uses no longer trips over `steps`.
    expect(referencingStepIds(draft, "participants", "P9")).toEqual([]);
  });

  it("carries optional and unknown top-level keys through", () => {
    const draft = normalizeDefinition({
      description: "Serve receive",
      view: { orientation: "top_down" },
      future_field: true,
    });

    expect(draft.description).toBe("Serve receive");
    expect(draft.view).toEqual({ orientation: "top_down" });
    expect((draft as unknown as Record<string, unknown>).future_field).toBe(
      true,
    );
  });

  it("fills every step array the panes iterate", () => {
    const draft = normalizeDefinition({ steps: [{ id: "Warmup" }] });

    expect(draft.steps).toEqual([emptyStep("Warmup")]);
  });

  it("generates ids for id-less steps and repairs duplicates", () => {
    const draft = normalizeDefinition({ steps: [{}, {}, { id: "S2" }] });

    expect(draft.steps.map((step) => step.id)).toEqual(["S1", "S2", "S3"]);
  });

  it("drops catalog entries and placements the panes could not key", () => {
    const draft = normalizeDefinition({
      participants: [{ id: "P1", type: "player" }, { type: "player" }, 7],
      steps: [
        {
          id: "S1",
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
            { active: true },
            null,
          ],
        },
      ],
    });

    expect(draft.participants).toEqual([{ id: "P1", type: "player" }]);
    expect(draft.steps[0].participants).toEqual([
      { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
    ]);
  });

  it("drops movements the court cannot draw and actions with no participant", () => {
    const draft = normalizeDefinition({
      steps: [
        {
          id: "S1",
          participant_movements: [
            { participant_id: "P1", to: { side: "side_1", x: 2, y: 2 } },
            { participant_id: "P1" },
            { to: { side: "side_1", x: 2, y: 2 } },
          ],
          actions: [
            { participant_id: "P1", action: { type: "serve" } },
            { action: { type: "serve" } },
          ],
        },
      ],
    });

    expect(draft.steps[0].participant_movements).toEqual([
      { participant_id: "P1", to: { side: "side_1", x: 2, y: 2 } },
    ]);
    expect(draft.steps[0].actions).toEqual([
      { participant_id: "P1", action: { type: "serve" } },
    ]);
  });

  it("keeps a stored side grid, defaulting only when it is unusable", () => {
    const custom = normalizeDefinition({
      side: { grid: { columns: 10, rows: 20 } },
    });
    const broken = normalizeDefinition({
      side: { grid: { columns: 0, rows: 20 } },
    });

    expect(custom.side).toEqual({ grid: { columns: 10, rows: 20 } });
    expect(broken.side).toEqual(EMPTY_DEFINITION.side);
  });

  it("coerces the active flag into a boolean the panes can trust", () => {
    const truthy = normalizeDefinition({
      steps: [{ id: "S1", participants: [{ id: "P1", active: "yes" }] }],
    });
    const missing = normalizeDefinition({
      steps: [{ id: "S1", participants: [{ id: "P1" }] }],
    });

    expect(truthy.steps[0].participants[0].active).toBe(true);
    expect(missing.steps[0].participants[0].active).toBe(false);
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

/** Two steps: P1 moves, B1 stays put, O1 stays put. */
const movingDrill: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "P1", type: "player" }],
  balls: [{ id: "B1", type: "volleyball" }],
  objects: [{ id: "O1", type: "cone" }],
  steps: [
    {
      id: "S1",
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 2, y: 1 } },
      ],
      balls: [
        { id: "B1", active: true, location: { side: "side_1", x: 3, y: 1 } },
      ],
      objects: [
        { id: "O1", active: true, location: { side: "side_2", x: 2, y: 2 } },
      ],
      actions: [],
      participant_movements: [],
      ball_movements: [],
      object_movements: [],
    },
    {
      id: "S2",
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 3, y: 1 } },
      ],
      balls: [
        { id: "B1", active: true, location: { side: "side_1", x: 3, y: 1 } },
      ],
      objects: [
        { id: "O1", active: true, location: { side: "side_2", x: 2, y: 2 } },
      ],
      actions: [],
      participant_movements: [],
      ball_movements: [],
      object_movements: [],
    },
  ],
};

/**
 * The invariant Rails' `DrillDefinitionValidator#check_movement_consistency`
 * enforces: a movement's `from` is its entity's active location in its own
 * step, and its `to` is the entity's active location in the next step.
 */
function assertMovementInvariant(definition: DrillDefinition): void {
  const pairs = [
    {
      states: "participants",
      movements: "participant_movements",
      idKey: "participant_id",
    },
    { states: "balls", movements: "ball_movements", idKey: "ball_id" },
    { states: "objects", movements: "object_movements", idKey: "object_id" },
  ] as const;

  definition.steps.forEach((step, index) => {
    const next = definition.steps[index + 1];
    for (const pair of pairs) {
      const current = activeLocations(step[pair.states]);
      const nextLocations = next
        ? activeLocations(next[pair.states])
        : undefined;
      for (const movement of step[pair.movements]) {
        const id = (movement as unknown as Record<string, unknown>)[
          pair.idKey
        ] as string;
        if (movement.from) {
          expect(sameLocation(movement.from, current.get(id))).toBe(true);
        }
        if (nextLocations) {
          expect(sameLocation(movement.to, nextLocations.get(id))).toBe(true);
        }
      }
    }
  });
}

describe("syncMovements", () => {
  it("derives a movement only for entities that change position", () => {
    const synced = syncMovements(movingDrill);

    expect(synced.steps[0].participant_movements).toEqual([
      {
        participant_id: "P1",
        from: { side: "side_1", x: 2, y: 1 },
        to: { side: "side_1", x: 3, y: 1 },
      },
    ]);
    // B1 and O1 are in the same spot in both steps: nothing to animate.
    expect(synced.steps[0].ball_movements).toEqual([]);
    expect(synced.steps[0].object_movements).toEqual([]);
  });

  it("drops movements for entities that are no longer active", () => {
    const synced = syncMovements({
      ...movingDrill,
      steps: [
        movingDrill.steps[0],
        {
          ...movingDrill.steps[1],
          participants: [
            {
              id: "P1",
              active: false,
              location: { side: "side_1", x: 3, y: 1 },
            },
          ],
        },
      ],
    });

    expect(synced.steps[0].participant_movements).toEqual([]);
  });

  it("preserves an authored description across a re-sync", () => {
    const withDescription: DrillDefinition = {
      ...movingDrill,
      steps: [
        {
          ...movingDrill.steps[0],
          participant_movements: [
            {
              participant_id: "P1",
              from: { side: "side_1", x: 2, y: 1 },
              to: { side: "side_1", x: 3, y: 1 },
              description: "P1 crosses",
            },
          ],
        },
        movingDrill.steps[1],
      ],
    };

    const synced = syncMovements(withDescription);
    expect(synced.steps[0].participant_movements[0].description).toBe(
      "P1 crosses",
    );
  });

  it("keeps authored movements on the last step, normalising `from`", () => {
    const synced = syncMovements({
      ...movingDrill,
      steps: [
        movingDrill.steps[0],
        {
          ...movingDrill.steps[1],
          ball_movements: [
            {
              ball_id: "B1",
              to: { side: "side_2", x: 1, y: 1 },
              description: "coach feeds",
            },
          ],
        },
      ],
    });

    const lastStepMovement = synced.steps[1].ball_movements[0];
    expect(lastStepMovement.description).toBe("coach feeds");
    expect(lastStepMovement.to).toEqual({ side: "side_2", x: 1, y: 1 });
    // `from` is normalised to B1's active location in that same step.
    expect(lastStepMovement.from).toEqual({ side: "side_1", x: 3, y: 1 });
  });

  it("satisfies the schema and the Rails movement invariant", () => {
    const synced = syncMovements(movingDrill);
    expect(validateDrillDefinition(synced).valid).toBe(true);
    assertMovementInvariant(synced);
  });

  it("is idempotent", () => {
    const once = syncMovements(movingDrill);
    expect(syncMovements(once)).toEqual(once);
  });
});

describe("syncMovementsAt", () => {
  /** S1, S2, S3 where only S2's P1 position has been edited. */
  const threeSteps = (): DrillDefinition => ({
    ...movingDrill,
    steps: [
      movingDrill.steps[0],
      {
        ...movingDrill.steps[1],
        participants: [
          {
            id: "P1",
            active: true,
            location: { side: "side_2", x: 5, y: 4 },
          },
        ],
      },
      { ...movingDrill.steps[1], id: "S3" },
    ],
  });

  it("re-derives both pairs that the edited step belongs to", () => {
    const synced = syncMovementsAt(threeSteps(), 1);

    // S1 → S2 now targets the new S2 position.
    expect(synced.steps[0].participant_movements[0]).toEqual({
      participant_id: "P1",
      from: { side: "side_1", x: 2, y: 1 },
      to: { side: "side_2", x: 5, y: 4 },
    });
    // S2 → S3 starts from that same new position.
    expect(synced.steps[1].participant_movements[0].from).toEqual({
      side: "side_2",
      x: 5,
      y: 4,
    });
  });

  it("leaves unrelated steps untouched (same object identity)", () => {
    const definition = threeSteps();
    const synced = syncMovementsAt(definition, 1);
    expect(synced.steps[2]).toBe(definition.steps[2]);
  });
});

describe("step-builder helpers", () => {
  const catalogDrill = (): DrillDefinition => ({
    version: 1,
    side: { grid: { columns: 5, rows: 4 } },
    participants: [{ id: "P1", type: "player" }],
    balls: [{ id: "B1", type: "volleyball" }],
    objects: [{ id: "O1", type: "cone" }],
    steps: [emptyStep("S1"), emptyStep("S2")],
  });

  it("adds a catalog entity to a step, active and inside the Rails bounds", () => {
    const next = addEntityToStep(catalogDrill(), 0, "participants", "P1");

    expect(next.steps[0].participants).toEqual([
      {
        id: "P1",
        active: true,
        location: { side: "side_1", x: 3, y: 2 },
      },
    ]);
    // Other steps are untouched: positions are per step.
    expect(next.steps[1].participants).toEqual([]);
    expect(validateDrillDefinition(next).valid).toBe(true);
  });

  it("ignores unknown entities and duplicate placements", () => {
    const definition = catalogDrill();
    expect(addEntityToStep(definition, 0, "participants", "P9")).toBe(definition);

    const placed = addEntityToStep(definition, 0, "participants", "P1");
    expect(addEntityToStep(placed, 0, "participants", "P1")).toBe(placed);
  });

  it("toggling active off drops the derived movement; on restores the location", () => {
    const synced = syncMovements(movingDrill);
    expect(synced.steps[0].participant_movements).toHaveLength(1);

    const off = setEntityActive(synced, 1, "participants", "P1", false);
    expect(off.steps[1].participants[0].active).toBe(false);
    expect(off.steps[0].participant_movements).toEqual([]);
    assertMovementInvariant(off);

    const on = setEntityActive(off, 1, "participants", "P1", true);
    expect(on.steps[1].participants[0].location).toEqual({
      side: "side_1",
      x: 3,
      y: 1,
    });
    expect(on.steps[0].participant_movements).toHaveLength(1);
  });

  it("dragging a ghost re-targets the movement without touching the current step", () => {
    // B1 must be active on both steps for a movement to exist between them.
    const both = addEntityToStep(
      addEntityToStep(movingDrill, 1, "balls", "B1"),
      0,
      "balls",
      "B1",
    );
    expect(syncMovements(both).steps[0].ball_movements).toHaveLength(0);

    const next = setEntityLocation(both, 1, "balls", "B1", {
      side: "side_2",
      x: 1,
      y: 1,
    });
    // The current step's own placement is untouched; only the ghost moved.
    expect(next.steps[0].balls[0].location).toEqual({ side: "side_1", x: 3, y: 1 });
    expect(next.steps[0].ball_movements).toEqual([
      {
        ball_id: "B1",
        from: { side: "side_1", x: 3, y: 1 },
        to: { side: "side_2", x: 1, y: 1 },
      },
    ]);
    assertMovementInvariant(next);
  });

  it("removing an entity from a step cascades into actions and movements", () => {
    const withAction = addActionToStep(movingDrill, 0, {
      participant_id: "P1",
      action: { type: "pass" },
    });
    const next = removeEntityFromStep(withAction, 0, "participants", "P1");

    expect(next.steps[0].participants).toEqual([]);
    expect(next.steps[0].actions).toEqual([]);
    expect(next.steps[0].participant_movements).toEqual([]);
    // The catalog keeps the entity: only the step reference is gone.
    expect(next.participants).toHaveLength(1);
    expect(validateDrillDefinition(next).valid).toBe(true);
  });

  it("adds and removes actions only for participants placed on the step", () => {
    const definition = addEntityToStep(catalogDrill(), 0, "participants", "P1");
    const action = {
      participant_id: "P1",
      action: { type: "toss" as const, description: "coach feeds" },
    };

    const added = addActionToStep(definition, 0, action);
    expect(added.steps[0].actions).toEqual([action]);

    expect(addActionToStep(definition, 0, { ...action, participant_id: "P9" })).toBe(
      definition,
    );

    const removed = removeActionFromStep(added, 0, 0);
    expect(removed.steps[0].actions).toEqual([]);
    expect(removeActionFromStep(added, 0, 7)).toBe(added);
  });

  it("editing a movement description survives a re-sync; deleting freezes the arrow", () => {
    const synced = syncMovements(movingDrill);

    const annotated = setMovementDescription(
      synced,
      0,
      "participants",
      0,
      "P1 crosses",
    );
    expect(annotated.steps[0].participant_movements[0].description).toBe(
      "P1 crosses",
    );
    // The annotation is carried over when positions change again.
    expect(syncMovements(annotated).steps[0].participant_movements[0].description).toBe(
      "P1 crosses",
    );

    const cleared = setMovementDescription(synced, 0, "participants", 0, "");
    expect("description" in cleared.steps[0].participant_movements[0]).toBe(false);

    const frozen = removeMovement(synced, 0, "participants", 0);
    // Deleting equalises the next position so the arrow stays gone.
    expect(frozen.steps[1].participants[0].location).toEqual(
      frozen.steps[0].participants[0].location,
    );
    expect(frozen.steps[0].participant_movements).toEqual([]);
    assertMovementInvariant(frozen);
  });

  it("defaultStepLocation stays inside the extended grid", () => {
    const centre = defaultStepLocation(EMPTY_DEFINITION);
    expect(centre).toEqual({ side: "side_1", x: 3, y: 2 });
  });
describe("setViewOrientation", () => {
  it("writes view.orientation and clears the whole key when unset", () => {
    const base = { ...EMPTY_DEFINITION };

    const topDown = setViewOrientation(base, "top_down");
    expect(topDown.view).toEqual({ orientation: "top_down" });

    const lateral = setViewOrientation(topDown, "lateral");
    expect(lateral.view).toEqual({ orientation: "lateral" });

    const cleared = setViewOrientation(lateral, undefined);
    expect("view" in cleared).toBe(false);
    // Clearing an absent view is a no-op (same object identity).
    expect(setViewOrientation(base, undefined)).toBe(base);
  });
});

describe("setMovementTarget", () => {
  /** S2 (the last step) carries an authored ball movement. */
  const authoredLast = (): DrillDefinition => ({
    ...movingDrill,
    steps: [
      movingDrill.steps[0],
      {
        ...movingDrill.steps[1],
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
  });

  it("edits the authored `to` on the last step, clamped to the bounds", () => {
    const next = setMovementTarget(authoredLast(), 1, "balls", 0, {
      side: "side_1",
      x: 99,
      y: 0,
    });

    expect(next.steps[1].ball_movements[0].to).toEqual({
      side: "side_1",
      x: 5,
      y: 1,
    });
    expect(next.steps[1].ball_movements[0].description).toBe("coach feeds");
  });

  it("is a no-op on non-last steps, bad indexes and unknown sides", () => {
    const definition = authoredLast();
    expect(
      setMovementTarget(definition, 0, "balls", 0, { side: "side_1", x: 1, y: 1 }),
    ).toBe(definition);
    expect(
      setMovementTarget(definition, 1, "balls", 9, { side: "side_1", x: 1, y: 1 }),
    ).toBe(definition);
    expect(
      setMovementTarget(definition, 1, "balls", 0, {
        side: "side_9" as "side_1",
        x: 1,
        y: 1,
      }),
    ).toBe(definition);
  });
});

describe("duplicateStep", () => {
  it("splits a middle-step pair: original→copy no-op, copy→next keeps the arrow", () => {
    const synced = syncMovements(movingDrill);
    const duplicated = duplicateStep(synced, 0);

    expect(duplicated.steps).toHaveLength(3);
    expect(duplicated.steps[1].id).toBe("S3");
    // Original → copy: identical positions, so no arrow.
    expect(duplicated.steps[0].participant_movements).toEqual([]);
    // Copy → next: the arrow rides along.
    expect(duplicated.steps[1].participant_movements).toEqual([
      {
        participant_id: "P1",
        from: { side: "side_1", x: 2, y: 1 },
        to: { side: "side_1", x: 3, y: 1 },
      },
    ]);
    assertMovementInvariant(duplicated);
    expect(validateDrillDefinition(duplicated).valid).toBe(true);
  });

  it("preserves authored last-step movements instead of dropping them", () => {
    const definition = syncMovements(movingDrill);
    const withAuthored: DrillDefinition = {
      ...definition,
      steps: [
        definition.steps[0],
        {
          ...definition.steps[1],
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

    const copy = duplicateStep(withAuthored, 1).steps[2];
    expect(copy.ball_movements).toEqual([
      {
        ball_id: "B1",
        from: { side: "side_1", x: 3, y: 1 },
        to: { side: "side_1", x: 4, y: 2 },
        description: "coach feeds",
      },
    ]);
  });
});

describe("court setup helpers", () => {
  /** syncMovements(movingDrill): P1 (2,1)→(3,1) is the one derived arrow. */
  const syncedMovingDrill = () => syncMovements(movingDrill);

  it("setGrid shrinks the court and clamps placements inside the new bounds", () => {
    const edit = setGrid(syncedMovingDrill(), { columns: 2, rows: 2 });

    expect(edit.definition.side.grid).toEqual({ columns: 2, rows: 2 });
    expect(edit.movedPlacements).toBeGreaterThan(0);
    const allInside = edit.definition.steps.every((step) =>
      [...step.participants, ...step.balls, ...step.objects].every(
        (state) =>
          !state.location ||
          (state.location.x >= 1 &&
            state.location.x <= 2 &&
            state.location.y >= 1 &&
            state.location.y <= 2),
      ),
    );
    expect(allInside).toBe(true);
    assertMovementInvariant(edit.definition);
    expect(validateDrillDefinition(edit.definition).valid).toBe(true);
  });

  it("setGrid rejects non-finite drafts and reports no movement when widening", () => {
    const definition = syncedMovingDrill();
    expect(setGrid(definition, { columns: NaN, rows: 4 }).definition).toBe(
      definition,
    );
    const widened = setGrid(definition, { columns: 8, rows: 6 });
    expect(widened.definition.side.grid).toEqual({ columns: 8, rows: 6 });
    expect(widened.movedPlacements).toBe(0);
    expect(widened.movedTargets).toBe(0);
  });

  it("setExtendedArea disabling clears the flags so editor and server agree", () => {
    const definition: DrillDefinition = {
      ...syncedMovingDrill(),
      side: {
        grid: { columns: 5, rows: 4 },
        extended_area: { enabled: true, left: true },
      },
    };

    const off = setExtendedArea(definition, undefined);
    expect(off.definition.side.extended_area).toEqual({ enabled: false });

    const on = setExtendedArea(definition, {
      enabled: true,
      left: false,
      right: true,
      side_1: false,
      side_2: false,
    });
    expect(on.definition.side.extended_area).toEqual({
      enabled: true,
      left: false,
      right: true,
      side_1: false,
      side_2: false,
    });
  });

  it("clampDefinitionToBounds covers inactive states and last-step targets", () => {
    const definition: DrillDefinition = {
      ...movingDrill,
      side: { grid: { columns: 2, rows: 2 } },
      steps: [
        {
          ...movingDrill.steps[0],
          // Inactive but located: Rails still bounds-checks it.
          participants: [
            { id: "P1", active: false, location: { side: "side_1", x: 5, y: 4 } },
          ],
        },
        {
          ...movingDrill.steps[1],
          participants: [
            { id: "P1", active: true, location: { side: "side_1", x: 2, y: 2 } },
          ],
          ball_movements: [
            // Authored last-step target outside the shrunk bounds.
            { ball_id: "B1", to: { side: "side_1", x: 9, y: 9 } },
          ],
        },
      ],
    };

    const edit = clampDefinitionToBounds(definition);
    expect(edit.definition.steps[0].participants[0].location).toEqual({
      side: "side_1",
      x: 2,
      y: 2,
    });
    expect(edit.definition.steps[1].ball_movements[0].to).toEqual({
      side: "side_1",
      x: 2,
      y: 2,
    });
    expect(edit.movedPlacements).toBe(3);
    expect(edit.movedTargets).toBe(1);
  });

  it("clampDefinitionToBounds is a no-op when everything already fits", () => {
    const definition = syncedMovingDrill();
    expect(clampDefinitionToBounds(definition)).toEqual({
      definition,
      movedPlacements: 0,
      movedTargets: 0,
    });
  });
});

});