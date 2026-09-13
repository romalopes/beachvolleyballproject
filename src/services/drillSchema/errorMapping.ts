/**
 * Maps Rails validation error strings onto the same `DrillSchemaIssue` shape
 * the client-side JSON Schema validator produces, so a single issue list can
 * display both the React pre-check and the authoritative server response.
 *
 * Rails' `DrillDefinitionValidator` adds full messages prefixed by the
 * humanised attribute name ("Definition ...") and the layer that produced
 * them:
 *
 *   "Definition schema: /steps/0 — must be object"
 *   "Definition domain: duplicate participant id 'P1'"
 *
 * Other ActiveModel errors (title blank, player ranges, ...) fall through to a
 * generic `server` keyword so they are still shown, just without a path.
 */

import type { DrillSchemaIssue } from "./validator";

const SCHEMA_PATTERN = /^Definition schema:\s*(\S+)\s+—\s+(.+)$/;
const DOMAIN_PATTERN = /^Definition domain:\s*(.+)$/;

/** Convert an array of server error strings into issue objects. */
export function mapServerErrors(
  errors: readonly string[]
): DrillSchemaIssue[] {
  return errors.map((raw) => {
    const schema = raw.match(SCHEMA_PATTERN);
    if (schema) {
      // Rails uses "root" for errors with no JSON pointer; the client validator
      // uses an empty instancePath for the same case.
      return {
        instancePath: schema[1] === "root" ? "" : schema[1],
        keyword: "schema",
        message: schema[2],
      };
    }

    const domain = raw.match(DOMAIN_PATTERN);
    if (domain) {
      return { instancePath: "", keyword: "domain", message: domain[1] };
    }

    return { instancePath: "", keyword: "server", message: raw };
  });
}

/** Human-readable single line for one issue: "/steps/0: must be object". */
export function formatIssue(issue: DrillSchemaIssue): string {
  const path = issue.instancePath || "(root)";
  return `${path}: ${issue.message}`;
}
