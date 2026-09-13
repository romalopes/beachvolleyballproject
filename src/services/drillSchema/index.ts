/**
 * Public surface for the drill-schema validation package.
 *
 * See validator.ts for the runtime JSON Schema check and types.ts for the
 * TypeScript shapes that mirror the shared JSON Schema.
 */

// Types — re-exported with `export type` because verbatimModuleSyntax
// requires it when re-exporting a type-only symbol.
export type {
  DrillDefinition,
  ObjectType,
  Orientation,
  ParticipantType,
  BallType,
  ActionType,
  CourtId,
  Grid,
  ExtendedArea,
  Court,
  ViewConfig,
  Location,
  Participant,
  Ball,
  DrillObject,
  EntityState,
  Action,
  ActionEvent,
  ParticipantMovement,
  BallMovement,
  ObjectMovement,
  Step,
} from "./types";

// Value — the validation function is a runtime export.
export { validateDrillDefinition } from "./validator";

// Types that live in validator.ts (the validation result shape).
export type { DrillSchemaIssue, DrillSchemaValidation } from "./validator";

// Parse + validate textarea input (JSON.parse errors + schema issues).
export { parseAndValidateDefinition } from "./parse";
export type { DrillDefinitionParseResult } from "./parse";

// Map Rails validation error strings onto DrillSchemaIssue objects.
export { mapServerErrors, formatIssue } from "./errorMapping";


