/**
 * Shared drill model — the single `DrillDefinition` the whole editor works on.
 *
 * Three jobs live here:
 *   1. Round-trip serialisation for the JSON textarea (no validation).
 *   2. Normalising a stored/parsed value into the render-safe model the visual
 *      panes index into (`normalizeDefinition`).
 *   3. Pure, immutable model edits the visual builder composes (id generation,
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
  ActionEvent,
  Ball,
  DrillDefinition,
  DrillObject,
  EntityState,
  ExtendedArea,
  Location,
  Movement,
  Orientation,
  Participant,
  Step,
} from "../../../drill/definition";
import { editorBounds } from "../../../drill/geometry";

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

// ---- draft normalisation ---------------------------------------

/** Non-null, non-array object; `null` for anything the panes cannot read. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** The value as an array, or `[]` — the panes always iterate these fields. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Coerce a stored or parsed value into the render-safe editor model.
 *
 * The visual panes index straight into the definition (`side.grid`,
 * `steps[i].participants`, …), but neither source of the model guarantees that
 * shape:
 *   • Rails defaults the column to `{}` (`null: false`), so a drill without a
 *     visualisation arrives as an empty object, and
 *   • `jsonTextToDefinition` casts whatever JSON parses, so a hand-edited draft
 *     can be missing whole sections.
 *
 * This fills exactly what the panes read and leaves the author's data otherwise
 * alone: optional keys (`description`, `view`, …) and unknown fields are carried
 * over, unknown enum values are preserved so the issue panel can still report
 * them, and a valid definition comes back deep-equal to its input. It
 * guarantees *renderability*, not schema validity — the JSON editor's live
 * feedback stays the authority on the latter.
 */
export function normalizeDefinition(value: unknown): DrillDefinition {
  const draft = asRecord(value) ?? {};
  return {
    // Anything unrecognised is carried over so a visual edit cannot drop it.
    ...draft,
    // `version` is the schema's `const: 1`; a hand-edited number is preserved
    // so the schema feedback keeps flagging it.
    version: typeof draft.version === "number" ? (draft.version as 1) : 1,
    side: normalizeSide(draft.side),
    participants: normalizeCatalog(draft.participants) as Participant[],
    balls: normalizeCatalog(draft.balls) as Ball[],
    objects: normalizeCatalog(draft.objects) as DrillObject[],
    steps: normalizeSteps(draft.steps),
  };
}

/** The stored side, or the editor default when its grid is unusable. */
function normalizeSide(value: unknown): DrillDefinition["side"] {
  const side = asRecord(value);
  const grid = asRecord(side?.grid);
  const columns = grid?.columns;
  const rows = grid?.rows;
  if (
    typeof columns !== "number" ||
    typeof rows !== "number" ||
    columns <= 0 ||
    rows <= 0
  ) {
    return EMPTY_DEFINITION.side;
  }
  // The record passed the shape check above; the assertion only bridges the
  // index-signature type `asRecord` yields.
  return side as unknown as DrillDefinition["side"];
}

/** True for a record the panes can key by a non-empty string id. */
function hasId(
  value: unknown,
): value is { id: string } & Record<string, unknown> {
  const record = asRecord(value);
  return record !== null && typeof record.id === "string" && record.id !== "";
}

/** Catalog entries the panes can key by id; id-less entries are dropped. */
function normalizeCatalog(value: unknown): unknown[] {
  return asArray(value).filter((entry) => hasId(entry));
}

/** Placed entity state: a keyable `id`, boolean `active`, optional `location`. */
function normalizeStates(value: unknown): EntityState[] {
  return asArray(value).flatMap((entry) => {
    if (!hasId(entry)) return [];
    const location = asRecord(entry.location);
    return [
      {
        ...entry,
        id: entry.id,
        active: Boolean(entry.active),
        ...(location === null
          ? {}
          : { location: location as unknown as Location }),
      },
    ];
  });
}

/** Actions the step builder lists: a participant id plus an action body. */
function normalizeActions(value: unknown): ActionEvent[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const action = asRecord(record?.action);
    const participantId = record?.participant_id;
    if (record === null || action === null) return [];
    if (typeof participantId !== "string" || participantId === "") return [];
    return [{ ...record, action } as unknown as ActionEvent];
  });
}

/**
 * Movements the court can draw. `MovementArrow` needs `to` on every entry and
 * the editor skips entries without an entity id, so both are required here.
 */
function normalizeMovements(
  value: unknown,
  idKey: "participant_id" | "ball_id" | "object_id",
): Movement[] {
  return asArray(value).flatMap((entry) => {
    const movement = asRecord(entry);
    if (movement === null) return [];
    const id = movement[idKey];
    if (typeof id !== "string" || id === "") return [];
    if (asRecord(movement.to) === null) return [];
    return [movement as unknown as Movement];
  });
}

/** Every step keeps its seven schema arrays; a missing `id` is generated. */
function normalizeSteps(value: unknown): Step[] {
  const entries = asArray(value);
  if (entries.length === 0) return [emptyStep("S1")];
  const taken = new Set<string>();
  return entries.map((entry) => normalizeStep(entry, taken));
}

function normalizeStep(value: unknown, taken: Set<string>): Step {
  const step = asRecord(value) ?? {};
  const storedId =
    typeof step.id === "string" && step.id !== "" ? step.id : null;
  // Duplicate ids are repaired too: they would collide as React keys.
  const id =
    storedId !== null && !taken.has(storedId.toLowerCase())
      ? storedId
      : newEntityId([...taken], "S");
  taken.add(id.toLowerCase());
  return {
    ...step,
    id,
    ...(typeof step.description === "string"
      ? { description: step.description }
      : {}),
    participants: normalizeStates(step.participants),
    balls: normalizeStates(step.balls),
    objects: normalizeStates(step.objects),
    actions: normalizeActions(step.actions),
    participant_movements: normalizeMovements(
      step.participant_movements,
      "participant_id",
    ),
    ball_movements: normalizeMovements(step.ball_movements, "ball_id"),
    object_movements: normalizeMovements(step.object_movements, "object_id"),
  };
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
      return definition.participants ?? [];
    case "balls":
      return definition.balls ?? [];
    case "objects":
      return definition.objects ?? [];
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

// ---- movement derivation ---------------------------------------
//
// Rails (`DrillDefinitionValidator#check_movement_consistency`) requires that,
// for every movement in a step:
//   • `from`, when present, equals the entity's ACTIVE location in that step;
//   • `to` equals the entity's ACTIVE location in the NEXT step (when one exists).
//
// A movement is therefore a derived annotation of a position change between
// consecutive steps — not a free-form arrow. These helpers keep that invariant
// true no matter how the user drags entities around, so the saved definition is
// always one the server accepts.

/** Exactly equal logical positions (same side and coordinates). */
export function sameLocation(a?: Location, b?: Location): boolean {
  return Boolean(a && b && a.side === b.side && a.x === b.x && a.y === b.y);
}

/** `active` + placed entities of a step, mapped id → location. */
export function activeLocations(states: EntityState[]): Map<string, Location> {
  const placed = new Map<string, Location>();
  for (const state of states) {
    if (state.active && state.location) placed.set(state.id, state.location);
  }
  return placed;
}

type MovementIdKey = "participant_id" | "ball_id" | "object_id";

/** The movement's entity id, or `null` when the record is malformed. */
function movementId(movement: Movement, idKey: MovementIdKey): string | null {
  const value = (movement as unknown as Record<string, unknown>)[idKey];
  return typeof value === "string" ? value : null;
}

/**
 * Rebuild one step's movement list of a single kind from the adjacent steps.
 *
 * With a next step: one movement per entity that is active and placed in both
 * steps at different locations — `from` = this step, `to` = next step. Existing
 * descriptions are carried over by entity id; stale or no-op entries disappear.
 *
 * Without a next step (the last step): there is no `to` to derive, so the
 * user's movements are kept and only `from` is normalised to the entity's
 * current active location (or dropped when it has none), keeping the origin
 * rule satisfied.
 */
function syncMovementsOfKind(
  currentStates: EntityState[],
  nextStates: EntityState[] | undefined,
  existing: Movement[],
  idKey: MovementIdKey,
  create: (
    id: string,
    from: Location | undefined,
    to: Location,
    description?: string,
  ) => Movement,
): Movement[] {
  const current = activeLocations(currentStates);
  const existingById = new Map<string, Movement>();
  for (const movement of existing) {
    const id = movementId(movement, idKey);
    if (id !== null && !existingById.has(id)) existingById.set(id, movement);
  }

  if (!nextStates) {
    const kept: Movement[] = [];
    for (const movement of existing) {
      const id = movementId(movement, idKey);
      if (id === null) continue;
      kept.push(
        create(id, current.get(id), movement.to, movement.description),
      );
    }
    return kept;
  }

  const next = activeLocations(nextStates);
  const derived: Movement[] = [];
  for (const [id, from] of current) {
    const to = next.get(id);
    if (!to || sameLocation(from, to)) continue;
    derived.push(create(id, from, to, existingById.get(id)?.description));
  }
  return derived;
}

/** Re-derive the movements of a single step pair. */
function syncStepMovements(step: Step, nextStep: Step | undefined): Step {
  return {
    ...step,
    participant_movements: syncMovementsOfKind(
      step.participants,
      nextStep?.participants,
      step.participant_movements,
      "participant_id",
      (id, from, to, description) => {
        const movement: Movement = { participant_id: id, to };
        if (from) movement.from = from;
        if (description !== undefined) movement.description = description;
        return movement;
      },
    ),
    ball_movements: syncMovementsOfKind(
      step.balls,
      nextStep?.balls,
      step.ball_movements,
      "ball_id",
      (id, from, to, description) => {
        const movement: Movement = { ball_id: id, to };
        if (from) movement.from = from;
        if (description !== undefined) movement.description = description;
        return movement;
      },
    ),
    object_movements: syncMovementsOfKind(
      step.objects,
      nextStep?.objects,
      step.object_movements,
      "object_id",
      (id, from, to, description) => {
        const movement: Movement = { object_id: id, to };
        if (from) movement.from = from;
        if (description !== undefined) movement.description = description;
        return movement;
      },
    ),
  };
}

/** Re-derive every step's movements (ids and descriptions preserved). */
export function syncMovements(definition: DrillDefinition): DrillDefinition {
  return {
    ...definition,
    steps: definition.steps.map((step, index) =>
      syncStepMovements(step, definition.steps[index + 1]),
    ),
  };
}

/**
 * Re-derive only the movements that depend on `stepIndex`'s positions — i.e.
 * that step's pair and the pair before it. Used after a drag so unrelated steps
 * (and any manually authored movements on them) are left untouched.
 */
export function syncMovementsAt(
  definition: DrillDefinition,
  stepIndex: number,
): DrillDefinition {
  const touched = new Set([stepIndex - 1, stepIndex]);
  return {
    ...definition,
    steps: definition.steps.map((step, index) =>
      touched.has(index)
        ? syncStepMovements(step, definition.steps[index + 1])
        : step,
    ),
  };
}

// ---- step-builder helpers -------------------------------------------

/**
 * Where an entity sits when it is first placed on a step. Centre-ish of
 * side 1, clamped into the Rails bounds so placements are always saveable.
 */
export function defaultStepLocation(definition: DrillDefinition): Location {
  const bounds = editorBounds(definition.side).side_1;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const { columns, rows } = definition.side.grid;
  return {
    side: "side_1",
    x: clamp(Math.ceil(columns / 2), bounds.minX, bounds.maxX),
    y: clamp(Math.ceil(rows / 2), bounds.minY, bounds.maxY),
  };
}

/** Step entity lists keyed like the catalog's `EntityKind` vocabulary. */
function stepStates(step: Step, kind: EntityKind): EntityState[] {
  switch (kind) {
    case "participants":
      return step.participants;
    case "balls":
      return step.balls;
    case "objects":
      return step.objects;
  }
}

function withStepStates(
  step: Step,
  kind: EntityKind,
  states: EntityState[],
): Step {
  switch (kind) {
    case "participants":
      return { ...step, participants: states };
    case "balls":
      return { ...step, balls: states };
    case "objects":
      return { ...step, objects: states };
  }
}

/**
 * Place a catalog entity on one step. A no-op when the entity is already on
 * that step (or unknown to the catalog) — "Add" buttons stay idempotent.
 */
export function addEntityToStep(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  id: string,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const catalogIds = new Set(entityList(definition, kind).map((e) => e.id));
  if (!catalogIds.has(id)) return definition;
  if (stepStates(step, kind).some((state) => state.id === id)) return definition;
  const next: DrillDefinition = {
    ...definition,
    steps: definition.steps.map((candidate, index) =>
      index === stepIndex
        ? withStepStates(candidate, kind, [
            ...stepStates(candidate, kind),
            { id, active: true, location: defaultStepLocation(definition) },
          ])
        : candidate,
    ),
  };
  return syncMovementsAt(next, stepIndex);
}
/** Toggle an entity's `active` flag on one step. */
export function setEntityActive(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  id: string,
  active: boolean,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const states = stepStates(step, kind);
  if (!states.some((state) => state.id === id)) return definition;
  const next: DrillDefinition = {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      return withStepStates(
        candidate,
        kind,
        stepStates(candidate, kind).map((state) => {
          if (state.id !== id) return state;
          return {
            ...state,
            active,
            location:
              active && !state.location
                ? defaultStepLocation(definition)
                : state.location,
          };
        }),
      );
    }),
  };
  return syncMovementsAt(next, stepIndex);
}

/** Move an entity's stored location on one step (no-op for unknown placements). */
export function setEntityLocation(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  id: string,
  location: Location,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  if (!stepStates(step, kind).some((state) => state.id === id)) return definition;
  const next: DrillDefinition = {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      return withStepStates(
        candidate,
        kind,
        stepStates(candidate, kind).map((state) => {
          if (state.id !== id) return state;
          return { ...state, location };
        }),
      );
    }),
  };
  return syncMovementsAt(next, stepIndex);
}
/**
 * Remove an entity from one step, cascading into that step's actions and
 * re-derived movements so nothing dangles. Other steps are untouched.
 */
export function removeEntityFromStep(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  id: string,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  if (!stepStates(step, kind).some((state) => state.id === id)) return definition;
  const next: DrillDefinition = {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      const without = withStepStates(
        candidate,
        kind,
        stepStates(candidate, kind).filter((state) => state.id !== id),
      );
      if (kind !== "participants") return without;
      return {
        ...without,
        actions: without.actions.filter((a) => a.participant_id !== id),
      };
    }),
  };
  return syncMovementsAt(next, stepIndex);
}

/** Add an action for a participant placed on the step. */
export function addActionToStep(
  definition: DrillDefinition,
  stepIndex: number,
  action: ActionEvent,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const placed = step.participants.some((s) => s.id === action.participant_id);
  if (!placed) return definition;
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      return { ...candidate, actions: [...candidate.actions, { ...action }] };
    }),
  };
}

/** Remove one action (by index) from a step. */
export function removeActionFromStep(
  definition: DrillDefinition,
  stepIndex: number,
  actionIndex: number,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  if (actionIndex < 0 || actionIndex >= step.actions.length) return definition;
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      return {
        ...candidate,
        actions: candidate.actions.filter((_, i) => i !== actionIndex),
      };
    }),
  };
}
type MovementListKey =
  | "participant_movements"
  | "ball_movements"
  | "object_movements";

function movementListKey(kind: EntityKind): MovementListKey {
  switch (kind) {
    case "participants":
      return "participant_movements";
    case "balls":
      return "ball_movements";
    case "objects":
      return "object_movements";
  }
}

/**
 * Edit a derived movement's annotation. The description is the only edit that
 * survives a re-sync; from/to stay derived from positions so a movement can
 * never contradict the steps it connects.
 */
export function setMovementDescription(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  movementIndex: number,
  description: string | undefined,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const key = movementListKey(kind);
  if (movementIndex < 0 || movementIndex >= step[key].length) return definition;
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      const movements = candidate[key].map((movement, i) => {
        if (i !== movementIndex) return movement;
        if (description === undefined || description === "") {
          const rest = { ...movement };
          delete rest.description;
          return rest;
        }
        return { ...movement, description };
      });
      return { ...candidate, [key]: movements };
    }),
  };
}

/**
 * Edit the authored `to` of a last-step movement. Only the last step has
 * authored targets — every earlier step derives `to` from the next step's
 * positions — so edits elsewhere (or bad indexes) are no-ops. The target is
 * clamped into the Rails bounds, exactly like a drag would be.
 */
export function setMovementTarget(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  movementIndex: number,
  target: Location,
): DrillDefinition {
  if (stepIndex !== definition.steps.length - 1) return definition;
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const key = movementListKey(kind);
  const movement = step[key][movementIndex];
  if (!movement) return definition;
  const bounds = editorBounds(definition.side);
  const side = bounds[target.side];
  if (!side) return definition;
  const to: Location = {
    ...target,
    x: Math.min(side.maxX, Math.max(side.minX, target.x)),
    y: Math.min(side.maxY, Math.max(side.minY, target.y)),
  };
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      return {
        ...candidate,
        [key]: candidate[key].map((entry, i) =>
          i === movementIndex ? { ...entry, to } : entry,
        ),
      };
    }),
  };
}

/**
 * Remove a derived movement arrow. Because movements are derived from position
 * changes, deleting the arrow also equalises the entity's next-step position
 * to its current one, so the arrow does not re-derive on the next drag and
 * the saved definition stays consistent.
 */
export function removeMovement(
  definition: DrillDefinition,
  stepIndex: number,
  kind: EntityKind,
  movementIndex: number,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const key = movementListKey(kind);
  const movement = step[key][movementIndex];
  if (!movement) return definition;
  const idKey =
    kind === "participants"
      ? "participant_id"
      : kind === "balls"
        ? "ball_id"
        : "object_id";
  const id = movementId(movement, idKey);
  if (id === null) return definition;
  const from = activeLocations(stepStates(step, kind)).get(id);
  if (!from) return definition;
  const nextStep = definition.steps[stepIndex + 1];
  if (!nextStep) {
    return {
      ...definition,
      steps: definition.steps.map((candidate, index) => {
        if (index !== stepIndex) return candidate;
        return {
          ...candidate,
          [key]: candidate[key].filter((_, i) => i !== movementIndex),
        };
      }),
    };
  }
  const steps = definition.steps.map((candidate, index) => {
    if (index !== stepIndex + 1) return candidate;
    return withStepStates(
      candidate,
      kind,
      stepStates(candidate, kind).map((state) => {
        if (state.id !== id) return state;
        return { ...state, location: from };
      }),
    );
  });
  return syncMovementsAt({ ...definition, steps }, stepIndex + 1);
}

// ---- step management -------------------------------------------------

/** Next free `S<n>` step id, compared case-insensitively. */
export function nextStepId(definition: DrillDefinition): string {
  return newEntityId(
    definition.steps.map((step) => step.id),
    "S",
  );
}

/** Append a fresh step; the definition always keeps at least one step. */
export function addStep(definition: DrillDefinition): DrillDefinition {
  const step = emptyStep(nextStepId(definition));
  return { ...definition, steps: [...definition.steps, step] };
}

/**
 * Duplicate a step (id re-generated, description carried over). Positions are
 * copied verbatim — an exact clone is the most useful starting point — and the
 * movement annotations are carried with the copy too. Re-deriving then splits
 * each pair correctly: the original keeps its relation to the copy (identical
 * positions ⇒ no arrow) and the copy keeps its relation to the step that
 * follows. The wipe-then-derive version dropped authored arrows on the last
 * step, where there is no next step to re-derive `to` from.
 */
export function duplicateStep(
  definition: DrillDefinition,
  stepIndex: number,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  if (!step) return definition;
  const copy: Step = {
    ...step,
    ...emptyStep(nextStepId(definition)),
    description: step.description,
    participants: step.participants.map((state) => ({ ...state })),
    balls: step.balls.map((state) => ({ ...state })),
    objects: step.objects.map((state) => ({ ...state })),
    actions: step.actions.map((action) => ({ ...action })),
    participant_movements: step.participant_movements.map((movement) => ({
      ...movement,
    })),
    ball_movements: step.ball_movements.map((movement) => ({ ...movement })),
    object_movements: step.object_movements.map((movement) => ({ ...movement })),
  };
  const steps = [...definition.steps];
  steps.splice(stepIndex + 1, 0, copy);
  return syncMovements({ ...definition, steps });
}

/**
 * Remove a step and re-derive every movement: the pair before the removed step
 * now flows into the step that followed it. The last remaining step cannot be
 * removed (schema `steps.minItems: 1`).
 */
export function removeStep(
  definition: DrillDefinition,
  stepIndex: number,
): DrillDefinition {
  if (definition.steps.length <= 1) return definition;
  if (stepIndex < 0 || stepIndex >= definition.steps.length) return definition;
  return syncMovements({
    ...definition,
    steps: definition.steps.filter((_, index) => index !== stepIndex),
  });
}

/** Move a step up (-1) or down (+1); out-of-range moves are no-ops. */
export function moveStep(
  definition: DrillDefinition,
  stepIndex: number,
  delta: -1 | 1,
): DrillDefinition {
  const target = stepIndex + delta;
  if (target < 0 || target >= definition.steps.length) return definition;
  const steps = [...definition.steps];
  const [moved] = steps.splice(stepIndex, 1);
  steps.splice(target, 0, moved);
  // Both affected pairs change, so re-derive everything.
  return syncMovements({ ...definition, steps });
}

// ---- court setup -----------------------------------------------------

/**
 * A court-shape edit plus what it had to move to stay saveable.
 *
 * Rails bounds-checks every placed coordinate (and every movement `from`/`to`)
 * against the bounds derived from grid + extended_area, so a smaller court or a
 * dropped extension would otherwise leave the drill unsaveable, with an error
 * only the server could explain.
 */
export interface CourtEdit {
  definition: DrillDefinition;
  /** Placed states (any step, kind, active or not) nudged inside the bounds. */
  movedPlacements: number;
  /** Authored movement targets nudged inside the bounds. */
  movedTargets: number;
}

/** Clamp one location into the editor (Rails) bounds. */
function clampLocation(
  location: Location,
  bounds: ReturnType<typeof editorBounds>,
): Location {
  const side = bounds[location.side];
  // An unknown side is the schema's business, not ours: never invent one.
  if (!side) return location;
  const x = Math.min(side.maxX, Math.max(side.minX, location.x));
  const y = Math.min(side.maxY, Math.max(side.minY, location.y));
  return x === location.x && y === location.y ? location : { ...location, x, y };
}

/**
 * Pull every placement inside the current bounds, then re-derive the movements.
 *
 * Two details make this more than a plain clamp:
 *   • Rails bounds-checks a state whenever it *has* a location, so inactive
 *     placements are clamped too.
 *   • The last step has no next step to derive `to` from, so `syncMovements`
 *     keeps its targets as authored — they must be clamped explicitly.
 *
 * A widening (or no-op) edit changes nothing and returns the author's
 * definition untouched, so unrelated manual edits are never rewritten.
 */
export function clampDefinitionToBounds(
  definition: DrillDefinition,
): CourtEdit {
  const bounds = editorBounds(definition.side);
  let movedPlacements = 0;
  let movedTargets = 0;

  const clampState = (state: EntityState): EntityState => {
    if (!state.location) return state;
    const location = clampLocation(state.location, bounds);
    if (sameLocation(location, state.location)) return state;
    movedPlacements += 1;
    return { ...state, location };
  };

  const clampTargets = (movements: Movement[]): Movement[] =>
    movements.map((movement) => {
      const to = clampLocation(movement.to, bounds);
      if (sameLocation(to, movement.to)) return movement;
      movedTargets += 1;
      return { ...movement, to };
    });

  const lastIndex = definition.steps.length - 1;
  const steps = definition.steps.map((step, index) => {
    const clamped: Step = {
      ...step,
      participants: step.participants.map(clampState),
      balls: step.balls.map(clampState),
      objects: step.objects.map(clampState),
    };
    // Only the last step's targets are authored: every earlier step derives its
    // `to` from the next step, which the clamp above has already fixed.
    if (index !== lastIndex) return clamped;
    return {
      ...clamped,
      participant_movements: clampTargets(clamped.participant_movements),
      ball_movements: clampTargets(clamped.ball_movements),
      object_movements: clampTargets(clamped.object_movements),
    };
  });

  if (movedPlacements === 0 && movedTargets === 0) {
    return { definition, movedPlacements: 0, movedTargets: 0 };
  }
  // Re-derive every pair so each movement's from/to follows the new positions.
  return {
    definition: syncMovements({ ...definition, steps }),
    movedPlacements,
    movedTargets,
  };
}

/**
 * Resize the court grid (schema: integers ≥ 1) and pull placements inside the
 * new bounds. A draft that is not a finite number is not written at all.
 */
export function setGrid(
  definition: DrillDefinition,
  grid: { columns: number; rows: number },
): CourtEdit {
  if (!Number.isFinite(grid.columns) || !Number.isFinite(grid.rows)) {
    return { definition, movedPlacements: 0, movedTargets: 0 };
  }
  const columns = Math.max(1, Math.trunc(grid.columns));
  const rows = Math.max(1, Math.trunc(grid.rows));
  return clampDefinitionToBounds({
    ...definition,
    side: { ...definition.side, grid: { columns, rows } },
  });
}

/**
 * Set the extended area, or switch it off.
 *
 * Switching off drops the flags on purpose: Rails derives its bounds from
 * `left`/`right`/`side_1`/`side_2` alone, while the court geometry additionally
 * requires `enabled`. Leaving stale flags behind would make the editor stricter
 * than the server, so the two would disagree about the same drill.
 */
export function setExtendedArea(
  definition: DrillDefinition,
  area: ExtendedArea | undefined,
): CourtEdit {
  const side: DrillDefinition["side"] = { ...definition.side };
  if (area?.enabled) {
    side.extended_area = {
      enabled: true,
      left: Boolean(area.left),
      right: Boolean(area.right),
      side_1: Boolean(area.side_1),
      side_2: Boolean(area.side_2),
    };
  } else {
    side.extended_area = { enabled: false };
  }
  return clampDefinitionToBounds({ ...definition, side });
}

/**
 * Set the definition's default view orientation. `undefined` (or an empty
 * select value) clears the `view` key — an absent orientation means "the
 * viewer decides", which is the schema's default too. Separated from the
 * court pane's preview toggle, which never writes to the model.
 */
export function setViewOrientation(
  definition: DrillDefinition,
  orientation: Orientation | undefined,
): DrillDefinition {
  if (orientation === undefined) {
    if (!("view" in definition)) return definition;
    const next: DrillDefinition = { ...definition };
    delete next.view;
    return next;
  }
  return { ...definition, view: { orientation } };
}

// ---- step + definition metadata --------------------------------------

/** Set one step's description; a blank string clears it. */
export function setStepDescription(
  definition: DrillDefinition,
  stepIndex: number,
  description: string,
): DrillDefinition {
  if (!definition.steps[stepIndex]) return definition;
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) => {
      if (index !== stepIndex) return candidate;
      const next: Step = { ...candidate };
      if (description === "") delete next.description;
      else next.description = description;
      return next;
    }),
  };
}

/** Set the summary the viewer shows above the court; a blank string clears it. */
export function setDefinitionDescription(
  definition: DrillDefinition,
  description: string,
): DrillDefinition {
  const next: DrillDefinition = { ...definition };
  if (description === "") delete next.description;
  else next.description = description;
  return next;
}

// ---- per-step text annotations ----------------------------------------

import { DEFAULT_TEXT_ANNOTATION, type TextAnnotation } from "../../../drill/definition";

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** Annotations of one step, defaulting to `[]`. */
function annotationsOf(step: Step): TextAnnotation[] {
  return step.annotations ?? [];
}

/** Map one step, returning the definition unchanged when the index is out of range. */
function mapStep(
  definition: DrillDefinition,
  stepIndex: number,
  fn: (step: Step) => Step,
): DrillDefinition {
  if (!definition.steps[stepIndex]) return definition;
  return {
    ...definition,
    steps: definition.steps.map((candidate, index) =>
      index === stepIndex ? fn(candidate) : candidate,
    ),
  };
}

/** Add a default Text annotation to a step, with a unique per-step id. */
export function addStepAnnotation(
  definition: DrillDefinition,
  stepIndex: number,
): DrillDefinition {
  return mapStep(definition, stepIndex, (step) => {
    const annotations = [...annotationsOf(step)];
    let n = annotations.length + 1;
    const taken = new Set(annotations.map((a) => a.id));
    while (taken.has(`text_${n}`)) n += 1;
    const bounds = editorBounds(definition.side);
    const grid = definition.side.grid;
    // Sensible starting point: net-side of side 1, first sideline — always
    // inside the playable bounds, whatever the grid/extensions are.
    const location: Location = {
      side: "side_1",
      x: Math.min(Math.max(grid.columns, bounds.side_1.minX), bounds.side_1.maxX),
      y: Math.min(Math.max(1, bounds.side_1.minY), bounds.side_1.maxY),
    };
    const annotation: TextAnnotation = {
      ...DEFAULT_TEXT_ANNOTATION,
      location,
      id: `text_${n}`,
    };
    annotations.push(annotation);
    return { ...step, annotations };
  });
}

/** Patch one annotation of a step; unknown id is a no-op. */
export function updateStepAnnotation(
  definition: DrillDefinition,
  stepIndex: number,
  id: string,
  patch: Partial<Omit<TextAnnotation, "id" | "type">>,
): DrillDefinition {
  return mapStep(definition, stepIndex, (step) => ({
    ...step,
    annotations: annotationsOf(step).map((a) =>
      a.id === id ? { ...a, ...patch } : a,
    ),
  }));
}

/**
 * Move an annotation by its logical location (side + grid x/y) — the same
 * coordinate system players use, so the text keeps its place on the court
 * when the orientation changes. The location is clamped to the playable
 * bounds, exactly like a player placement.
 */
export function moveStepAnnotation(
  definition: DrillDefinition,
  stepIndex: number,
  id: string,
  location: Location,
): DrillDefinition {
  const step = definition.steps[stepIndex];
  const annotation = step?.annotations?.find((a) => a.id === id);
  if (!step || !annotation) return definition;

  const bounds = editorBounds(definition.side)[location.side];
  if (!bounds) return definition;
  const clamped: Location = {
    side: location.side,
    x: Math.min(Math.max(location.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(location.y, bounds.minY), bounds.maxY),
  };

  return mapStep(definition, stepIndex, (candidate) => ({
    ...candidate,
    annotations: annotationsOf(candidate).map((a) =>
      a.id === id ? { ...a, location: clamped } : a,
    ),
  }));
}

/** Resize an annotation's box (fractions of the side's rendered rect). */
export function resizeStepAnnotation(
  definition: DrillDefinition,
  stepIndex: number,
  id: string,
  width: number,
  height: number,
): DrillDefinition {
  return mapStep(definition, stepIndex, (step) => ({
    ...step,
    annotations: annotationsOf(step).map((a) =>
      a.id === id
        ? { ...a, width: clamp01(width), height: clamp01(height) }
        : a,
    ),
  }));
}

/** Remove one annotation from a step; unknown id is a no-op. */
export function removeStepAnnotation(
  definition: DrillDefinition,
  stepIndex: number,
  id: string,
): DrillDefinition {
  return mapStep(definition, stepIndex, (step) => ({
    ...step,
    annotations: annotationsOf(step).filter((a) => a.id !== id),
  }));
}
