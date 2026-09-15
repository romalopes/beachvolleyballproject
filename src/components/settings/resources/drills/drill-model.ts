/**
 * Shared drill model — the single `DrillDefinition` the whole editor works on.
 *
 * Two jobs live here:
 *   1. Round-trip serialisation for the JSON textarea (no validation).
 *   2. Pure, immutable model edits the visual builder composes (id generation,
 *      reference checks, renaming with cascade).
 *
 * Validation (JSON.parse errors + Ajv schema issues) lives in
 * `services/drillSchema/parse.ts` and is intentionally NOT repeated here — the
 * live feedback keeps using `parseAndValidateDefinition` against the JSON text.
 *
 * Phase-0 decision: use the existing `DrillDefinition` type directly, no
 * bespoke `EditorDrill` wrapper.
 */

import type {
  Ball,
  DrillDefinition,
  DrillObject,
  EntityState,
  Participant,
  Step,
} from "../../../drill/definition";

/** A step with every array present (schema-required) and nothing placed yet. */
export function emptyStep(id: string): Step {
  return {
    id,
    participants: [],
    balls: [],
    objects: [],
    actions: [],
    participant_movements: [],
    ball_movements: [],
    object_movements: [],
  };
}

/**
 * Boilerplate a brand-new drill starts from once the user begins building
 * visually. Satisfies the shared v1 schema (`steps` requires at least one step).
 */
export const EMPTY_DEFINITION: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [emptyStep("S1")],
};

/**
 * `DrillDefinition` → the pretty-printed JSON string the textarea shows.
 * This is what "the JSON on time" means: every visual edit re-derives the
 * JSON text from the same model the viewer would render.
 */
export function definitionToJsonText(d: DrillDefinition): string {
  return JSON.stringify(d, null, 2);
}

/**
 * JSON text → `DrillDefinition`, or `null` when the text is blank / not
 * parseable JSON. Schema validation is intentionally NOT performed here — the
 * caller (DrillForm) still runs `parseAndValidateDefinition` so the issue
 * panel keeps working and the submit guard keeps rejecting invalid defs.
 */
export function jsonTextToDefinition(
  text: string,
): DrillDefinition | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    // A definition is always a JSON object; arrays and primitives are not.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as DrillDefinition;
  } catch {
    return null;
  }
}

// ---- entity catalog helpers ------------------------------------

/** The three per-drill entity lists, keyed by their drill-definition fields. */
export type EntityKind = "participants" | "balls" | "objects";

/** The entity shape stored in each `EntityKind` list. */
export interface EntityShapeByKind {
  participants: Participant;
  balls: Ball;
  objects: DrillObject;
}

/**
 * The entity list for `kind`, typed as the union of the three entity shapes.
 * Written as a switch because indexing `DrillDefinition` with the union key
 * yields a union of array types, which TypeScript cannot `.map`/`.filter` over.
 */
export function entityList(
  definition: DrillDefinition,
  kind: EntityKind,
): (Participant | Ball | DrillObject)[] {
  switch (kind) {
    case "participants":
      return definition.participants;
    case "balls":
      return definition.balls;
    case "objects":
      return definition.objects;
  }
}

/** `<select>` value a freshly added entity starts with (schema enum member). */
export const DEFAULT_ENTITY_TYPE: {
  [K in EntityKind]: EntityShapeByKind[K]["type"];
} = {
  participants: "player",
  balls: "volleyball",
  objects: "cone",
};

/** Id prefix per kind, so generated ids read like the sample definitions. */
const ID_PREFIX: Record<EntityKind, string> = {
  participants: "P",
  balls: "B",
  objects: "O",
};

/** First free `<prefix><n>` id, compared case-insensitively. */
export function newEntityId(existing: string[], prefix: string): string {
  const taken = new Set(existing.map((id) => id.toLowerCase()));
  let n = 1;
  while (taken.has(`${prefix}${n}`.toLowerCase())) n += 1;
  return `${prefix}${n}`;
}

/** Id an "Add" button should propose for a new entity of `kind`. */
export function nextEntityId(
  definition: DrillDefinition,
  kind: EntityKind,
): string {
  return newEntityId(
    entityList(definition, kind).map((entity) => entity.id),
    ID_PREFIX[kind],
  );
}

/**
 * Ids of the steps referencing `id`, restricted to `kind`. Empty when the
 * entity is unused (and therefore safe to remove). Checks placed entity state,
 * participant actions and the three movement arrays — everything that points at
 * an entity by id.
 */
export function referencingStepIds(
  definition: DrillDefinition,
  kind: EntityKind,
  id: string,
): string[] {
  return definition.steps
    .filter((step) => {
      if (step[kind].some((state) => state.id === id)) return true;
      if (kind === "participants") {
        return (
          step.actions.some((a) => a.participant_id === id) ||
          step.participant_movements.some((m) => m.participant_id === id)
        );
      }
      if (kind === "balls") {
        return step.ball_movements.some((m) => m.ball_id === id);
      }
      return step.object_movements.some((m) => m.object_id === id);
    })
    .map((step) => step.id);
}

/** True when `id` is referenced by any step (entity state, action or movement). */
export function isEntityReferenced(
  definition: DrillDefinition,
  kind: EntityKind,
  id: string,
): boolean {
  return referencingStepIds(definition, kind, id).length > 0;
}

/**
 * Rename an entity, cascading the new id into every step reference — placed
 * entity state, participant actions and the movement arrays — so the
 * definition stays internally consistent. The schema cannot express these
 * cross-references, so the editor owns them.
 */
export function renameEntityId(
  definition: DrillDefinition,
  kind: EntityKind,
  oldId: string,
  newId: string,
): DrillDefinition {
  if (oldId === newId) return definition;

  const renameState = (state: EntityState): EntityState =>
    state.id === oldId ? { ...state, id: newId } : state;

  const steps = definition.steps.map((step) => {
    switch (kind) {
      case "participants":
        return {
          ...step,
          participants: step.participants.map(renameState),
          actions: step.actions.map((a) =>
            a.participant_id === oldId ? { ...a, participant_id: newId } : a,
          ),
          participant_movements: step.participant_movements.map((m) =>
            m.participant_id === oldId ? { ...m, participant_id: newId } : m,
          ),
        };
      case "balls":
        return {
          ...step,
          balls: step.balls.map(renameState),
          ball_movements: step.ball_movements.map((m) =>
            m.ball_id === oldId ? { ...m, ball_id: newId } : m,
          ),
        };
      case "objects":
        return {
          ...step,
          objects: step.objects.map(renameState),
          object_movements: step.object_movements.map((m) =>
            m.object_id === oldId ? { ...m, object_id: newId } : m,
          ),
        };
    }
  });

  switch (kind) {
    case "participants":
      return {
        ...definition,
        participants: definition.participants.map((e) =>
          e.id === oldId ? { ...e, id: newId } : e,
        ),
        steps,
      };
    case "balls":
      return {
        ...definition,
        balls: definition.balls.map((e) =>
          e.id === oldId ? { ...e, id: newId } : e,
        ),
        steps,
      };
    case "objects":
      return {
        ...definition,
        objects: definition.objects.map((e) =>
          e.id === oldId ? { ...e, id: newId } : e,
        ),
        steps,
      };
  }
}

