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
  orientation: Orientation;
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
   */
  participant_movements?: Movement[];
  ball_movements?: Movement[];
  object_movements?: Movement[];
}

export interface DrillDefinition {
  version: 1;
  view: ViewConfig;
  court: CourtConfig;
  participants: Participant[];
  balls: Ball[];
  objects: DrillObject[];
  steps: Step[];
}

/**
 * Sample definition modeled on real Drill 5:
 * P1 tosses to the other side, P2 passes, P3 sets, P2 hits hard-driven line,
 * P1 runs to block/peel. Coach C1 feeds the second ball; a cone marks the
 * defensive target.
 */
export const SAMPLE_DRILL_DEFINITION: DrillDefinition = {
  version: 1,
  view: { orientation: "lateral" },
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
  ],
  steps: [
    {
      id: "S1",
      description:
        "Initial setup: P1 ready to toss from court 1; C1 waits behind the baseline with ball B2.",
      participants: [
        { id: "P1", active: true, location: { court: "court_1", x: 3, y: 1 } },
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
          location: { court: "court_1", x: 3, y: 0.5 },
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
      ],
      actions: [],
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
          location: { court: "court_2", x: 1, y: 1 },
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
      ball_movements: [
        {
          ball_id: "B1",
          from: { court: "court_1", x: 4, y: 4 },
          to: { court: "court_2", x: 2.5, y: 2.5 },
          description: "B1 travels over the net to P2.",
        },
      ],
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
          location: { court: "court_2", x: 2.5, y: 1.25 },
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
          from: { court: "court_1", x: 3, y: 1 },
          to: { court: "court_1", x: 2.5, y: 4 },
          description: "P1 crosses the net to block or peel.",
        },
        {
          participant_id: "P2",
          from: { court: "court_2", x: 2.5, y: 2.5 },
          to: { court: "court_2", x: 2.5, y: 1.25 },
          description: "P2 approaches the net to attack.",
        },
      ],
      ball_movements: [
        {
          ball_id: "B1",
          from: { court: "court_2", x: 2.5, y: 2.5 },
          to: { court: "court_2", x: 2.5, y: 1.25 },
          description: "B1 is set then attacked along the line.",
        },
        {
          ball_id: "B2",
          from: { court: "court_1", x: 3, y: 0.5 },
          to: { court: "court_2", x: 3.5, y: 2 },
          description: "B2 is fed across to P3.",
        },
      ],
    },
  ],
};
