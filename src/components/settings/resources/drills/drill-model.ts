/**
 * Serialisation helpers for the drill editor's shared model.
 *
 * The editor works with a single `DrillDefinition` as its source of truth
 * (Phase-0 decision: use the existing definition type directly, no bespoke
 * `EditorDrill` wrapper). These helpers translate between that model and the
 * JSON string that the form field and Rails consume.
 *
 * Validation (JSON.parse errors + Ajv schema issues) lives in
 * `services/drillSchema/parse.ts` and is intentionally NOT repeated here —
 * the editor only needs round-trip serialisation; the live feedback keeps
 * using `parseAndValidateDefinition` against the current JSON text.
 */

import type { DrillDefinition } from "../../../drill/definition";

/** Boilerplate a brand-new drill starts from in the visual builder. */
export const EMPTY_DEFINITION: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [],
  balls: [],
  objects: [],
  steps: [],
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
    const parsed = JSON.parse(trimmed);
    return parsed as DrillDefinition;
  } catch {
    return null;
  }
}

