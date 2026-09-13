/**
 * Parse + validate helper for drill-definition JSON entered as text in the UI.
 *
 * Keeps the "is this pasteable text a structurally valid definition?" concern
 * out of components: the editor owns formatting, this owns the JSON.parse and
 * the JSON Schema check from validator.ts.
 */

import { validateDrillDefinition, type DrillSchemaIssue } from "./validator";

export interface DrillDefinitionParseResult {
  /** Parsed value when the text is valid JSON, otherwise null. */
  definition: unknown | null;
  /** JSON.parse failure message, or null when parsing succeeded. */
  parseError: string | null;
  /** Structural issues reported by the shared v1 schema. */
  issues: DrillSchemaIssue[];
  /**
   * True when the field can be submitted: either blank (no definition), or
   * parseable JSON that satisfies the shared schema.
   */
  valid: boolean;
}

/**
 * Validate definition text captured from a `<textarea>`.
 *
 * Blank input is considered valid and yields `definition: null`, mirroring the
 * Rails `DrillDefinitionValidator` which skips blank definitions. Malformed
 * JSON short-circuits before touching the schema validator so the user sees
 * a precise parse error instead of a wall of schema noise.
 */
export function parseAndValidateDefinition(
  text: string
): DrillDefinitionParseResult {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { definition: null, parseError: null, issues: [], valid: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      definition: null,
      parseError:
        error instanceof Error ? error.message : "Definition is not valid JSON.",
      issues: [],
      valid: false,
    };
  }

  const result = validateDrillDefinition(parsed);
  return {
    definition: parsed,
    parseError: null,
    issues: result.issues,
    valid: result.valid,
  };
}
