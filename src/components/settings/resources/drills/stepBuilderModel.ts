import type {
  ActionType,
  DrillDefinition,
  EntityState,
  Location,
  Movement,
  Orientation,
  Step,
} from "../../../drill/definition";
import type { Layer } from "./InteractiveCourt";
import type { EntityKind } from "./drill-model";

export interface StepBuilderProps {
  definition: DrillDefinition;
  stepIndex: number;
  hasNext: boolean;
  selected: SelectedEntity | null;
  /** Chip / marker selection (owned by the surrounding builder layout). */
  onSelect: (kind: EntityKind, id: string) => void;
  onChange: (next: DrillDefinition) => void;
}

export interface SelectedEntity {
  kind: EntityKind;
  id: string;
}

export interface MovementEdit {
  kind: EntityKind;
  index: number;
  text: string;
}

export const ENTITY_KINDS: { kind: EntityKind; label: string }[] = [
  { kind: "participants", label: "Participants" },
  { kind: "balls", label: "Balls" },
  { kind: "objects", label: "Objects" },
];

export function movementListFor(step: Step, kind: EntityKind): Movement[] {
  switch (kind) {
    case "participants":
      return step.participant_movements;
    case "balls":
      return step.ball_movements;
    case "objects":
      return step.object_movements;
  }
}

export function movementEntityId(kind: EntityKind, movement: Movement): string {
  switch (kind) {
    case "participants":
      return movement.participant_id ?? "—";
    case "balls":
      return movement.ball_id ?? "—";
    case "objects":
      return movement.object_id ?? "—";
  }
}

export function statesFor(step: Step, kind: EntityKind): EntityState[] {
  switch (kind) {
    case "participants":
      return step.participants;
    case "balls":
      return step.balls;
    case "objects":
      return step.objects;
  }
}

export function placedIdsFor(step: Step, kind: EntityKind): Set<string> {
  return new Set(statesFor(step, kind).map((state) => state.id));
}

export function formatLocation(location: Location): string {
  return `${location.side === "side_1" ? "S1" : "S2"} (${location.x}, ${location.y})`;
}

export type { ActionType, DrillDefinition, Location, Movement, Orientation, Step, Layer };
