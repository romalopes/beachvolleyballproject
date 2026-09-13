/**
 * Runtime JSON Schema validation of drill definitions on the React side,
 * using the SAME schema contract as the Rails backend
 * (schemas/drill-definition-v1.schema.json).
 *
 * Structure is validated here (types, enums, required fields, allowed
 * actions/participant/object types, additionalProperties). Cross-step DOMAIN
 * rules (movement consistency, reference resolution, coordinate bounds) remain
 * the responsibility of the Rails `DrillDefinitionValidator` — React only
 * reports structural problems.
 *
 * The frontend copy in ./drill-definition-v1.schema.json must match the Rails
 * copy; see schemaConsistency.test.ts which enforces that single source.
 */

import Ajv2020 from "ajv/dist/2020";
import drillSchemaV1 from "./drill-definition-v1.schema.json";

export interface DrillSchemaIssue {
  instancePath: string;
  keyword: string;
  message: string;
}

export interface DrillSchemaValidation {
  valid: boolean;
  issues: DrillSchemaIssue[];
}

// Compile once per process. `strict: false` + `allErrors: true` keep Ajv a
// pure validator: it never repairs data, it reports every structural problem.
const ajv = new Ajv2020({ allErrors: true, strict: false });

// The schema is a plain JSON object (imported with resolveJsonModule); Ajv
// accepts any JSON Schema value here. draft-2020 ($defs, const, $id) is the
// schema's declared dialect, so we use the Ajv 2020 variant.
const validate = ajv.compile(drillSchemaV1);

/**
 * Validate a candidate drill definition object against the shared v1 schema.
 *
 * Returns `{ valid: true, issues: [] }` when the structure is sound, otherwise
 * `{ valid: false, issues: [...] }` where each issue mirrors the path, keyword
 * and message that Rails' JSONSchemer-based `DrillDefinitionValidator` would
 * also surface for the same structural problem.
 */
export function validateDrillDefinition(
  json: unknown
): DrillSchemaValidation {
  const ok = validate(json as Record<string, unknown>);
  if (ok) {
    return { valid: true, issues: [] };
  }
  // Ajv stores the current error list on the compiled validate function
  // (`validate.errors`), NOT on the Ajv instance. Each entry is an
  // ErrorObject with at least instancePath/keyword/message.
  const issues: DrillSchemaIssue[] = (validate.errors ?? []).map((e) => ({
    instancePath: e.instancePath,
    keyword: e.keyword,
    message: e.message ?? "is invalid",
  }));
  return { valid: false, issues };
}
