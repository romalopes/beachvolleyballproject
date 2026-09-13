/**
 * Drill definition model — v1.
 *
 * The definition describes the drill in logical terms only:
 * two courts, a 5x4 reference grid, fractional coordinates,
 * participants/balls/objects, ordered steps with full entity state,
 * separate actions and movements.
 *
 * No SVG or pixel coordinates live here — the renderer owns geometry.
 */

export type Orientation = "top_down" | "lateral";

/** Default court orientation used when a definition (or the user) specifies none. */
export const DEFAULT_ORIENTATION: Orientation = "lateral";
export type CourtId = "court_1" | "court_2";
export type ParticipantType =
  | "player"
  | "coach"
  | "assistant_coach"
  | "demonstrator";
export type BallType = "volleyball" | "frescoball" | "other";

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

/** Canonical action vocabulary — lowercase, deliberate, extensible by editing this list. */
export const ACTION_TYPES = [
  "serve",
  "receive",
  "pass",
  "set",
  "attack",
  "hit",
  "block",
  "peel",
  "defend",
  "save",
  "approach",
  "retreat",
  "run",
  "toss",
  "feed",
  "throw",
  "catch",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface ExtendedArea {
  enabled: boolean;
  /** Lateral (sideline) extensions of the physical court. */
  left?: boolean;
  right?: boolean;
  /** Areas beyond the respective baselines. */
  court_1?: boolean;
  court_2?: boolean;
}

export interface ViewConfig {
  /** Optional — orientation is a viewer concern now; defaults to DEFAULT_ORIENTATION. */
  orientation?: Orientation;
}

export interface CourtConfig {
  grid: { columns: number; rows: number };
  extended_area?: ExtendedArea;
}

/**
 * Logical location on one of the two courts.
 * x/y are fractional reference-grid coordinates, not pixels.
 */
export interface Location {
  court: CourtId;
  x: number;
  y: number;
}

export interface Participant {
  id: string;
  type: ParticipantType;
  role?: string;
  description?: string;
}

export interface Ball {
  id: string;
  type: BallType;
  description?: string;
}

export interface DrillObject {
  id: string;
  type: ObjectType;
  description?: string;
}

/** State of one spatial entity within a step. */
export interface EntityState {
  id: string;
  active: boolean;
  /** Required when active: exactly one location per active entity per step. */
  location?: Location;
}

export interface ActionEvent {
  participant_id: string;
  action: {
    type: ActionType;
    description?: string;
  };
}

/** Movement of participants/balls/objects between the current and next step state. */
export interface Movement {
  participant_id?: string;
  ball_id?: string;
  object_id?: string;
  /** Omitted on the first step (initial setup). */
  from?: Location;
  to: Location;
  description?: string;
}

export interface Step {
  id: string;
  description?: string;
  participants: EntityState[];
  balls: EntityState[];
  objects: EntityState[];
  actions: ActionEvent[];
  /**
   * Movements during this step. Convention:
   *   movement.from = entity location at the start of this step
   *   movement.to   = entity location in the NEXT step
   * First step movements may omit `from` (initial setup).
   *
   * Required by the v1 schema on every step (an empty array means "nothing
   * moves in this step"); the arrays may not be omitted entirely.
   */
  participant_movements: Movement[];
  ball_movements: Movement[];
  object_movements: Movement[];
}

export interface DrillDefinition {
  version: 1;
  /** Optional — human-readable summary of the drill, shown above the court. */
  description?: string;
  /** Optional — the viewer owns orientation via its own toggle. */
  view?: ViewConfig;
  court: CourtConfig;
  participants: Participant[];
  balls: Ball[];
  objects: DrillObject[];
  steps: Step[];
}

/**
 * Runtime guard for a usable v1 drill definition.
 *
 * The API returns `definition: {}` (the JSONB column default) for drills that
 * have no visualisation yet, and `null`/`undefined` for older shapes. This
 * guard lets callers safely fall back to a sample definition instead of
 * crashing inside the renderer.
 */
export function isDrillDefinition(value: unknown): value is DrillDefinition {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DrillDefinition>;
  return (
    d.version === 1 &&
    !!d.court &&
    Array.isArray(d.participants) &&
    Array.isArray(d.balls) &&
    Array.isArray(d.objects) &&
    Array.isArray(d.steps) &&
    d.steps.length > 0
  );
}

/** Returns the definition if it is a valid v1 definition, otherwise `null`. */
export function resolveDrillDefinition(value: unknown): DrillDefinition | null {
  return isDrillDefinition(value) ? value : null;
}

/**
 * Sample definition modeled on real Drill 5:
 * P1 tosses to the other side, P2 passes, P3 sets, P2 hits hard-driven line,
 * P1 runs to block/peel. Coach C1 feeds the second ball; a cone marks the
 * defensive target.
 */
export const SAMPLE_DRILL_DEFINITION: DrillDefinition = {
  version: 1,
  description:
    "Serve-and-attack drill: P1 tosses over the net, P2 passes, P3 sets, P2 hits hard-driven line. P1 crosses to block or peel.",
  court: {
    grid: { columns: 5, rows: 4 },
    extended_area: {
      enabled: true,
      left: true,
      right: true,
      court_1: true,
      court_2: true,
    },
  },
  participants: [
    {
      id: "P1",
      type: "player",
      role: "server/blocker",
      description: "Serves, then crosses to block or peels.",
    },
    {
      id: "P2",
      type: "player",
      role: "passer/attacker",
      description: "Passes, then attacks line.",
    },
    { id: "P3", type: "player", role: "setter", description: "Sets for P2." },
    {
      id: "C1",
      type: "coach",
      role: "feeder",
      description: "Feeds balls from the baseline.",
    },
  ],
  balls: [
    { id: "B1", type: "volleyball", description: "Main drill ball." },
    { id: "B2", type: "volleyball", description: "Coach's second ball." },
  ],
  objects: [
    { id: "O1", type: "cone", description: "Defensive target on court 2." },
    { id: "O2", type: "cone", description: "Defensive target on court 1." },
  ],
  steps: [
    {
      id: "S1",
      description:
        "Initial setup: P1 ready to toss from court 1; C1 waits behind the baseline with ball B2.",
      participants: [
        { id: "P1", active: true, location: { court: "court_1", x: 4, y: 1 } },
        {
          id: "P2",
          active: true,
          location: { court: "court_2", x: 2, y: 2 },
        },
        {
          id: "P3",
          active: true,
          location: { court: "court_2", x: 3.5, y: 2 },
        },
        {
          id: "C1",
          active: true,
          location: { court: "court_1", x: 4, y: 0.5 },
        },
      ],
      balls: [
        { id: "B1", active: true, location: { court: "court_1", x: 3, y: 1 } },
        {
          id: "B2",
          active: true,
          location: { court: "court_1", x: 3, y: 0.5 },
        },
      ],
      objects: [
        {
          id: "O1",
          active: true,
          location: { court: "court_2", x: 4.5, y: 1 },
        },
        {
          id: "O2",
          active: true,
          location: { court: "court_1", x: 2, y: 2 },
        },
      ],
      actions: [],
      participant_movements: [],
      ball_movements: [],
      object_movements: [],
    },
    {
      id: "S2",
      description:
        "P1 tosses B1 over the net; P2 receives and passes toward P3.",
      participants: [
        { id: "P1", active: true, location: { court: "court_1", x: 3, y: 1 } },
        {
          id: "P2",
          active: true,
          location: { court: "court_2", x: 2.5, y: 2.5 },
        },
        {
          id: "P3",
          active: true,
          location: { court: "court_2", x: 3.5, y: 2 },
        },
        {
          id: "C1",
          active: true,
          location: { court: "court_1", x: 3, y: 0.5 },
        },
      ],
      balls: [
        {
          id: "B1",
          active: true,
          location: { court: "court_1", x: 3, y: 2 },
        },
        {
          id: "B2",
          active: true,
          location: { court: "court_1", x: 3, y: 0.5 },
        },
      ],
      objects: [
        {
          id: "O1",
          active: true,
          location: { court: "court_2", x: 4.5, y: 1 },
        },
      ],
      actions: [
        {
          participant_id: "P1",
          action: { type: "toss", description: "Tosses B1 over the net." },
        },
        {
          participant_id: "P2",
          action: { type: "receive", description: "Receives the toss." },
        },
        {
          participant_id: "P2",
          action: { type: "pass", description: "Passes toward P3." },
        },
      ],

      participant_movements: [],
      ball_movements: [
        {
          ball_id: "B1",
          from: { court: "court_1", x: 3, y: 2 },
          to: { court: "court_2", x: 2.5, y: 1.25 },
          description: "B1 travels over the net to P2.",
        },
        {
          ball_id: "B2",
          from: { court: "court_1", x: 3, y: 0.5 },
          to: { court: "court_2", x: 3.5, y: 2 },
          description: "B2 is fed across to P3.",
        },
      ],
      object_movements: [],
    },
    {
      id: "S3",
      description:
        "P3 sets for P2, who attacks the line. P1 crosses to block or peel; C1 feeds B2 to keep the drill flowing.",
      participants: [
        {
          id: "P1",
          active: true,
          location: { court: "court_1", x: 2, y: 1 },
        },
        {
          id: "P2",
          active: true,
          location: { court: "court_2", x: 2.5, y: 2.3 },
        },
        {
          id: "P3",
          active: true,
          location: { court: "court_2", x: 3.5, y: 2 },
        },
        {
          id: "C1",
          active: true,
          location: { court: "court_1", x: 3, y: 0.5 },
        },
      ],
      balls: [
        {
          id: "B1",
          active: true,
          location: { court: "court_2", x: 2.5, y: 1.25 },
        },
        {
          id: "B2",
          active: true,
          location: { court: "court_2", x: 3.5, y: 2 },
        },
      ],
      objects: [
        {
          id: "O1",
          active: true,
          location: { court: "court_2", x: 4.5, y: 1 },
        },
      ],
      actions: [
        {
          participant_id: "P3",
          action: { type: "set", description: "Sets B1 for P2." },
        },
        {
          participant_id: "P2",
          action: { type: "approach", description: "Approaches to attack." },
        },
        {
          participant_id: "P2",
          action: {
            type: "attack",
            description: "Hard-driven attack down the line.",
          },
        },
        {
          participant_id: "P1",
          action: {
            type: "run",
            description: "Runs to block/peel at the net.",
          },
        },
        {
          participant_id: "C1",
          action: {
            type: "feed",
            description: "Feeds B2 to P3 to keep the drill going.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "P1",
          // from: { court: "court_1", x: 3, y: 1 },
          to: { court: "court_1", x: 3.5, y: 4 },
          description: "P1 crosses the net to block or peel.",
        },
        {
          participant_id: "P2",
          // from: { court: "court_2", x: 2.5, y: 2.5 },
          to: { court: "court_2", x: 3, y: 3.5 },
          description: "P2 approaches the net to attack.",
        },
      ],
      ball_movements: [
        {
          ball_id: "B1",
          from: { court: "court_2", x: 2.5, y: 1.25 },
          to: { court: "court_1", x: 2, y: 3 },
          description: "B1 is set then attacked down the line.",
        },
      ],
      object_movements: [],
    },
  ],
};
//////////////////// ######################### ///////////////
//////////////////// ######################### ///////////////
//////////////////// ######################### ///////////////

export const SAMPLE_DRILL_DEFINITION_1: DrillDefinition = {
  version: 1,
  description:
    "Serve-and-attack drill: P1 tosses over the net, P2 passes, P3 sets, P2 hits hard-driven line. P1 crosses to block or peel.",
  view: {
    orientation: "top_down",
  },
  court: {
    grid: {
      columns: 10,
      rows: 20,
    },
  },
  participants: [
    {
      id: "p1",
      type: "player",
      role: "server",
    },
    {
      id: "p2",
      type: "player",
      role: "receiver",
    },
    {
      id: "p3",
      type: "player",
      role: "setter",
    },
    {
      id: "p4",
      type: "player",
      role: "defender",
    },
  ],
  balls: [
    {
      id: "b1",
      type: "volleyball",
    },
  ],
  objects: [],
  steps: [
    {
      id: "step_1",
      description:
        "Server starts behind the baseline and serves toward the receiving team.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 1,
          },
        },
        {
          id: "p2",
          active: true,
          location: {
            court: "court_2",
            x: 3,
            y: 15,
          },
        },
        {
          id: "p3",
          active: true,
          location: {
            court: "court_2",
            x: 7,
            y: 15,
          },
        },
        {
          id: "p4",
          active: false,
          location: {
            court: "court_2",
            x: 5,
            y: 18,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 1,
          },
        },
      ],
      objects: [],
      actions: [
        {
          participant_id: "p1",
          action: {
            type: "serve",
            description: "Serve deep toward receiver.",
          },
        },
      ],
      participant_movements: [],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_1",
            x: 5,
            y: 1,
          },
          to: {
            court: "court_2",
            x: 3,
            y: 15,
          },
          description: "Ball travels from server toward receiver.",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_2",
      description: "Receiver moves into position and passes toward the setter.",
      participants: [
        {
          id: "p1",
          active: false,
          location: {
            court: "court_1",
            x: 5,
            y: 1,
          },
        },
        {
          id: "p2",
          active: true,
          location: {
            court: "court_2",
            x: 3,
            y: 15,
          },
        },
        {
          id: "p3",
          active: true,
          location: {
            court: "court_2",
            x: 7,
            y: 15,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_2",
            x: 3,
            y: 15,
          },
        },
      ],
      objects: [],
      actions: [
        {
          participant_id: "p2",
          action: {
            type: "receive",
            description: "Receive with controlled platform toward setter.",
          },
        },
        {
          participant_id: "p3",
          action: {
            type: "set",
            description: "Move toward the ball and prepare to set.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p3",
          from: {
            court: "court_2",
            x: 7,
            y: 15,
          },
          to: {
            court: "court_2",
            x: 5,
            y: 12,
          },
          description: "Setter moves toward the anticipated pass.",
        },
      ],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_2",
            x: 3,
            y: 15,
          },
          to: {
            court: "court_2",
            x: 5,
            y: 12,
          },
          description: "Pass travels toward setter.",
        },
      ],
      object_movements: [],
    },
  ],
};

export const SAMPLE_DRILL_DEFINITION_2: DrillDefinition = {
  version: 1,
  view: {
    orientation: "top_down",
  },
  court: {
    grid: {
      columns: 10,
      rows: 20,
    },
  },
  participants: [
    {
      id: "p1",
      type: "player",
      role: "passer",
      description: "Stationary passer who initiates the sequence.",
    },
    {
      id: "p2",
      type: "player",
      role: "passer",
      description: "Passer who moves to the setting position.",
    },
    {
      id: "p3",
      type: "player",
      role: "moving_setter",
      description: "Moves into the setting position.",
    },
    {
      id: "p4",
      type: "player",
      role: "moving_setter",
      description: "Moves into the setting position.",
    },
  ],
  balls: [
    {
      id: "b1",
      type: "volleyball",
      description: "Training ball",
    },
  ],
  objects: [],
  steps: [
    {
      id: "step_1",
      description:
        "P1 and P2 start stationary. P3 and P4 are positioned away from the setting position.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 6,
          },
        },
        {
          id: "p2",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 12,
          },
        },
        {
          id: "p3",
          active: true,
          location: {
            court: "court_1",
            x: 7,
            y: 5,
          },
        },
        {
          id: "p4",
          active: true,
          location: {
            court: "court_1",
            x: 7,
            y: 13,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 6,
          },
        },
      ],
      objects: [],
      actions: [
        {
          participant_id: "p1",
          action: {
            type: "pass",
            description: "P1 passes the ball to P2.",
          },
        },
      ],
      participant_movements: [],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_1",
            x: 3,
            y: 6,
          },
          to: {
            court: "court_1",
            x: 3,
            y: 12,
          },
          description: "P1 passes to P2.",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_2",
      description:
        "P2 moves from the receiving position to the setting position. P3 and P4 also move toward the setting area.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 6,
          },
        },
        {
          id: "p2",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
        {
          id: "p3",
          active: true,
          location: {
            court: "court_1",
            x: 6,
            y: 9,
          },
        },
        {
          id: "p4",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 11,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
      ],
      objects: [],
      actions: [
        {
          participant_id: "p2",
          action: {
            type: "set",
            description:
              "P2 moves to the setting position and prepares to set.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p2",
          from: {
            court: "court_1",
            x: 3,
            y: 12,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 10,
          },
          description:
            "P2 moves from the passing position to the setting position.",
        },
        {
          participant_id: "p3",
          from: {
            court: "court_1",
            x: 7,
            y: 5,
          },
          to: {
            court: "court_1",
            x: 6,
            y: 9,
          },
          description: "P3 moves toward the setting position.",
        },
        {
          participant_id: "p4",
          from: {
            court: "court_1",
            x: 7,
            y: 13,
          },
          to: {
            court: "court_1",
            x: 4,
            y: 11,
          },
          description: "P4 moves toward the setting position.",
        },
      ],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_1",
            x: 3,
            y: 12,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 10,
          },
          description: "The ball moves into the setting area.",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_3",
      description:
        "P3 and P4 move into the setting position and set the ball back toward P1.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 6,
          },
        },
        {
          id: "p2",
          active: false,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
        {
          id: "p3",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
        {
          id: "p4",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 10,
          },
        },
      ],
      objects: [],
      actions: [
        {
          participant_id: "p3",
          action: {
            type: "set",
            description: "P3 sets the ball back toward P1.",
          },
        },
        {
          participant_id: "p4",
          action: {
            type: "set",
            description: "P4 repeats the setting action toward P1.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p3",
          from: {
            court: "court_1",
            x: 6,
            y: 9,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 10,
          },
          description: "P3 moves into the setting position.",
        },
        {
          participant_id: "p4",
          from: {
            court: "court_1",
            x: 4,
            y: 11,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 10,
          },
          description: "P4 moves into the setting position.",
        },
      ],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_1",
            x: 5,
            y: 10,
          },
          to: {
            court: "court_1",
            x: 3,
            y: 6,
          },
          description: "P3/P4 set the ball back toward P1.",
        },
      ],
      object_movements: [],
    },
  ],
};
export const SAMPLE_DRILL_DEFINITION_3: DrillDefinition = {
  version: 1,
  court: {
    grid: {
      columns: 6,
      rows: 6,
    },
  },
  participants: [
    {
      id: "p_server",
      type: "player",
      role: "Server",
      description: "Player serving from Court 2 baseline",
    },
    {
      id: "p_passer",
      type: "player",
      role: "Passer",
      description: "Player receiving serve on Court 1",
    },
    {
      id: "p_setter",
      type: "player",
      role: "Setter",
      description: "Player setting to target",
    },
  ],
  balls: [
    {
      id: "ball_main",
      type: "volleyball",
      description: "Match ball",
    },
  ],
  objects: [
    {
      id: "target_hoop",
      type: "hoop",
      description: "Target landing zone for set precision",
    },
  ],
  steps: [
    {
      id: "step_1_serve",
      description: "Server initiates play with a float serve to deep Court 1.",
      participants: [
        {
          id: "p_server",
          active: true,
          location: {
            court: "court_2",
            x: 3,
            y: 6,
          },
        },
        {
          id: "p_passer",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 5,
          },
        },
        {
          id: "p_setter",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 2,
          },
        },
      ],
      balls: [
        {
          id: "ball_main",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 5,
          },
        },
      ],
      objects: [
        {
          id: "target_hoop",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 2,
          },
        },
      ],
      actions: [
        {
          participant_id: "p_server",
          action: {
            type: "serve",
            description: "Standing float serve",
          },
        },
      ],
      participant_movements: [],
      ball_movements: [
        {
          ball_id: "ball_main",
          from: {
            court: "court_2",
            x: 3,
            y: 6,
          },
          to: {
            court: "court_1",
            x: 4,
            y: 5,
          },
          description: "Serve trajectory across the net",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_2_pass_and_set",
      description:
        "Passer receives serve to net zone; Setter runs under and sets into the target hoop.",
      participants: [
        {
          id: "p_server",
          active: true,
          location: {
            court: "court_2",
            x: 3,
            y: 6,
          },
        },
        {
          id: "p_passer",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 5,
          },
        },
        {
          id: "p_setter",
          active: true,
          location: {
            court: "court_1",
            x: 3,
            y: 2,
          },
        },
      ],
      balls: [
        {
          id: "ball_main",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 2,
          },
        },
      ],
      objects: [
        {
          id: "target_hoop",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 2,
          },
        },
      ],
      actions: [
        {
          participant_id: "p_passer",
          action: {
            type: "receive",
            description: "Forearm pass target near net position 3",
          },
        },
        {
          participant_id: "p_setter",
          action: {
            type: "set",
            description: "Hand set into the target hoop area",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p_setter",
          from: {
            court: "court_1",
            x: 2,
            y: 2,
          },
          to: {
            court: "court_1",
            x: 3,
            y: 2,
          },
          description: "Adjust position under pass",
        },
      ],
      ball_movements: [
        {
          ball_id: "ball_main",
          from: {
            court: "court_1",
            x: 4,
            y: 5,
          },
          to: {
            court: "court_1",
            x: 3,
            y: 2,
          },
          description: "Pass path from defense to setting zone",
        },
        {
          ball_id: "ball_main",
          from: {
            court: "court_1",
            x: 3,
            y: 2,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 2,
          },
          description: "Set trajectory into target hoop",
        },
      ],
      object_movements: [],
    },
  ],
};
export const SAMPLE_DRILL_DEFINITION_4: DrillDefinition = {
  version: 1,
  view: {
    orientation: "top_down",
  },
  court: {
    grid: {
      columns: 6,
      rows: 6,
    },
    extended_area: {
      enabled: true,
      court_1: true,
      court_2: true,
    },
  },
  participants: [
    {
      id: "p_coach",
      type: "coach",
      role: "Feeder",
      description: "Feeds balls from high-line setter position",
    },
    {
      id: "p_hitter",
      type: "player",
      role: "Attacker",
      description: "Transitions from net to attack position",
    },
  ],
  balls: [
    {
      id: "ball_1",
      type: "volleyball",
      description: "Primary drill ball",
    },
  ],
  objects: [
    {
      id: "cone_1",
      type: "cone",
      description: "Transition depth marker",
    },
  ],
  steps: [
    {
      id: "step_1_setup",
      description:
        "Player starts at the net ready to block, coach holds ball near position 2.",
      participants: [
        {
          id: "p_coach",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 2,
          },
        },
        {
          id: "p_hitter",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 1,
          },
        },
      ],
      balls: [
        {
          id: "ball_1",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 2,
          },
        },
      ],
      objects: [
        {
          id: "cone_1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 4,
          },
        },
      ],
      actions: [],
      participant_movements: [],
      ball_movements: [],
      object_movements: [],
    },
    {
      id: "step_2_transition_and_toss",
      description:
        "Player retreats to cone marker while coach tosses a high set to position 4.",
      participants: [
        {
          id: "p_coach",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 2,
          },
        },
        {
          id: "p_hitter",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 4,
          },
        },
      ],
      balls: [
        {
          id: "ball_1",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 3,
          },
        },
      ],
      objects: [
        {
          id: "cone_1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 4,
          },
        },
      ],
      actions: [
        {
          participant_id: "p_coach",
          action: {
            type: "toss",
            description: "High toss towards position 4",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p_hitter",
          from: {
            court: "court_1",
            x: 4,
            y: 1,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 4,
          },
          description: "Footwork retreat back to approach marker",
        },
      ],
      ball_movements: [
        {
          ball_id: "ball_1",
          from: {
            court: "court_1",
            x: 2,
            y: 2,
          },
          to: {
            court: "court_1",
            x: 4,
            y: 3,
          },
          description: "Toss arc",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_3_attack",
      description:
        "Player approaches and attacks the ball over the net into Court 2.",
      participants: [
        {
          id: "p_coach",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 2,
          },
        },
        {
          id: "p_hitter",
          active: true,
          location: {
            court: "court_1",
            x: 4,
            y: 1.5,
          },
        },
      ],
      balls: [
        {
          id: "ball_1",
          active: true,
          location: {
            court: "court_2",
            x: 2,
            y: 5,
          },
        },
      ],
      objects: [
        {
          id: "cone_1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 4,
          },
        },
      ],
      actions: [
        {
          participant_id: "p_hitter",
          action: {
            type: "attack",
            description: "Hard-driven cross-court attack",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p_hitter",
          from: {
            court: "court_1",
            x: 5,
            y: 4,
          },
          to: {
            court: "court_1",
            x: 4,
            y: 1.5,
          },
          description: "Three-step approach jump",
        },
      ],
      ball_movements: [
        {
          ball_id: "ball_1",
          from: {
            court: "court_1",
            x: 4,
            y: 3,
          },
          to: {
            court: "court_2",
            x: 2,
            y: 5,
          },
          description: "Ball trajectory over net into deep cross-court",
        },
      ],
      object_movements: [],
    },
  ],
};
export const SAMPLE_DRILL_DEFINITION_5: DrillDefinition = {
  version: 1,
  view: {
    orientation: "top_down",
  },
  court: {
    grid: {
      columns: 10,
      rows: 20,
    },
  },
  participants: [
    {
      id: "p1",
      type: "player",
      role: "server_and_defender",
    },
    {
      id: "c1",
      type: "coach",
      role: "feeder",
    },
  ],
  balls: [
    {
      id: "b1",
      type: "volleyball",
    },
  ],
  objects: [
    {
      id: "cone_left",
      type: "cone",
      description: "Left movement target",
    },
    {
      id: "cone_right",
      type: "cone",
      description: "Right movement target",
    },
  ],
  steps: [
    {
      id: "step_1",
      description:
        "Player serves and immediately moves forward into defensive position.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 1,
          },
        },
        {
          id: "c1",
          active: true,
          location: {
            court: "court_2",
            x: 5,
            y: 15,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 1,
          },
        },
      ],
      objects: [
        {
          id: "cone_left",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 6,
          },
        },
        {
          id: "cone_right",
          active: true,
          location: {
            court: "court_1",
            x: 8,
            y: 6,
          },
        },
      ],
      actions: [
        {
          participant_id: "p1",
          action: {
            type: "serve",
            description: "Serve to the opposite court.",
          },
        },
        {
          participant_id: "p1",
          action: {
            type: "run",
            description: "Immediately transition into defensive position.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p1",
          from: {
            court: "court_1",
            x: 5,
            y: 1,
          },
          to: {
            court: "court_1",
            x: 5,
            y: 6,
          },
          description: "Sprint from serving position into defensive base.",
        },
      ],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_1",
            x: 5,
            y: 1,
          },
          to: {
            court: "court_2",
            x: 5,
            y: 15,
          },
          description: "Serve travels to opposite court.",
        },
      ],
      object_movements: [],
    },
    {
      id: "step_2",
      description:
        "Coach attacks or throws the ball toward one of the two defensive zones.",
      participants: [
        {
          id: "p1",
          active: true,
          location: {
            court: "court_1",
            x: 5,
            y: 6,
          },
        },
        {
          id: "c1",
          active: true,
          location: {
            court: "court_2",
            x: 5,
            y: 15,
          },
        },
      ],
      balls: [
        {
          id: "b1",
          active: true,
          location: {
            court: "court_2",
            x: 5,
            y: 15,
          },
        },
      ],
      objects: [
        {
          id: "cone_left",
          active: true,
          location: {
            court: "court_1",
            x: 2,
            y: 6,
          },
        },
        {
          id: "cone_right",
          active: true,
          location: {
            court: "court_1",
            x: 8,
            y: 6,
          },
        },
      ],
      actions: [
        {
          participant_id: "c1",
          action: {
            type: "throw",
            description:
              "Throw or hit ball toward left or right defensive zone.",
          },
        },
        {
          participant_id: "p1",
          action: {
            type: "defend",
            description:
              "Move quickly to the ball and execute a controlled dig.",
          },
        },
      ],
      participant_movements: [
        {
          participant_id: "p1",
          from: {
            court: "court_1",
            x: 5,
            y: 6,
          },
          to: {
            court: "court_1",
            x: 2,
            y: 6,
          },
          description: "Move laterally toward the defensive zone.",
        },
      ],
      ball_movements: [
        {
          ball_id: "b1",
          from: {
            court: "court_2",
            x: 5,
            y: 15,
          },
          to: {
            court: "court_1",
            x: 2,
            y: 6,
          },
          description: "Ball is directed toward left defensive zone.",
        },
      ],
      object_movements: [],
    },
  ],
};
