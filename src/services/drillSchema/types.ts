/**
 * TypeScript representations of the shapes declared in
 * drill-definition-v1.schema.json ($defs + root).
 *
 * These are maintained to match that shared JSON Schema, which is the single
 * source of truth and is owned by the Rails app
 * (beachvolleyballproject_api/schemas/drill-definition-v1.schema.json).
 *
 * The schemaConsistency.test.ts in this directory asserts that the frontend
 * schema *file* stays byte-identical to the Rails copy; this type layer should
 * be updated whenever the schema changes. The renderer's own
 * `components/drill/definition.ts` types mirror these shapes for UI
 * convenience and are kept aligned with the schema (movement arrays are
 * required on every step, though they may be empty).
 */

// ---- enums (mirror $defs) -------------------------------------

/** @see $defs/orientation */
export type Orientation = "top_down" | "lateral";

/** @see $defs/courtId */
export type CourtId = "court_1" | "court_2";

/** @see $defs/participantType */
export type ParticipantType =
  | "player"
  | "coach"
  | "assistant_coach"
  | "demonstrator";

/** @see $defs/ballType */
export type BallType = "volleyball" | "frescoball" | "other";

/** @see $defs/objectType */
export type ObjectType =
  | "cone"
  | "bench"
  | "obstacle"
  | "frescoball"
  | "target"
  | "basket"
  | "bucket"
  | "pole"
  | "hoop"
  | "marker"
  | "ladder"
  | "bag"
  | "net"
  | "chair"
  | "custom";

/** @see $defs/actionType */
export type ActionType =
  | "serve"
  | "receive"
  | "pass"
  | "set"
  | "attack"
  | "hit"
  | "block"
  | "peel"
  | "defend"
  | "save"
  | "approach"
  | "retreat"
  | "run"
  | "toss"
  | "feed"
  | "throw"
  | "catch";

// ---- leaf objects (mirror $defs) -----------------------------

/** @see $defs/grid */
export interface Grid {
  columns: number;
  rows: number;
}

/** @see $defs/extendedArea */
export interface ExtendedArea {
  enabled: boolean;
  left?: boolean;
  right?: boolean;
  court_1?: boolean;
  court_2?: boolean;
}

/** @see $defs/court */
export interface Court {
  grid: Grid;
  extended_area?: ExtendedArea;
}

/** @see $defs/view */
export interface ViewConfig {
  orientation?: Orientation;
}

/** @see $defs/location */
export interface Location {
  court: CourtId;
  x: number;
  y: number;
}

/** @see $defs/participant */
export interface Participant {
  id: string;
  type: ParticipantType;
  role?: string;
  description?: string;
}

/** @see $defs/ball */
export interface Ball {
  id: string;
  type: BallType;
  description?: string;
}

/** @see $defs/drillObject */
export interface DrillObject {
  id: string;
  type: ObjectType;
  description?: string;
}

/** @see $defs/entityState */
export interface EntityState {
  id: string;
  active: boolean;
  location?: Location;
}

/** @see $defs/action */
export interface Action {
  type: ActionType;
  description?: string;
}

/** @see $defs/actionEvent */
export interface ActionEvent {
  participant_id: string;
  action: Action;
}

/** @see $defs/participantMovement */
export interface ParticipantMovement {
  participant_id: string;
  from?: Location;
  to: Location;
  description?: string;
}

/** @see $defs/ballMovement */
export interface BallMovement {
  ball_id: string;
  from?: Location;
  to: Location;
  description?: string;
}

/** @see $defs/objectMovement */
export interface ObjectMovement {
  object_id: string;
  from?: Location;
  to: Location;
  description?: string;
}

/** @see $defs/step */
export interface Step {
  id: string;
  description?: string;
  participants: EntityState[];
  balls: EntityState[];
  objects: EntityState[];
  actions: ActionEvent[];
  participant_movements: ParticipantMovement[];
  ball_movements: BallMovement[];
  object_movements: ObjectMovement[];
}

// ---- root -----------------------------------------------------

/** Mirror of the schema root object (version is the literal `1` per `$defs` const). */
export interface DrillDefinition {
  version: 1;
  /** Optional — human-readable summary of the drill, shown above the court. */
  description?: string;
  view?: ViewConfig;
  court: Court;
  participants: Participant[];
  balls: Ball[];
  objects: DrillObject[];
  steps: Step[];
}
