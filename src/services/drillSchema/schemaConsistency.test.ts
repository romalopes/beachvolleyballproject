import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Path to the single source of truth: the Rails app's schema copy.
 *
 * vitest runs with process.cwd() set to the React app subdirectory
 * (beachvolleyballproject/). From there the Rails schema lives one level up
 * in ../beachvolleyballproject_api/schemas/.
 */
const PROJECT_ROOT = process.cwd();
const RAILS_SCHEMA_PATH = resolve(
  PROJECT_ROOT,
  "../beachvolleyballproject_api/schemas/drill-definition-v1.schema.json"
);

/** Path to the React app's own copy, kept in sync with the Rails copy. */
const FRONTEND_SCHEMA_PATH = resolve(
  PROJECT_ROOT,
  "./src/services/drillSchema/drill-definition-v1.schema.json"
);

describe("drill-definition-v1 schema synchronization", () => {
  it("frontend copy is byte-identical to the Rails copy", () => {
    const rails = readFileSync(RAILS_SCHEMA_PATH, "utf8");
    const frontend = readFileSync(FRONTEND_SCHEMA_PATH, "utf8");
    expect(frontend).toBe(rails);
  });

  it("frontend copy parses as a well-formed JSON Schema draft-2020 document", () => {
    const raw = readFileSync(FRONTEND_SCHEMA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
    expect(parsed.$id).toBe("drill-definition-v1");
    expect(parsed.type).toBe("object");
    expect(parsed.properties?.version).toEqual({ const: 1 });
    expect(parsed.required).toContain("version");
    expect(parsed.required).toContain("court");
    expect(parsed.required).toContain("participants");
    expect(parsed.required).toContain("balls");
    expect(parsed.required).toContain("objects");
    expect(parsed.required).toContain("steps");
    expect(parsed.$defs).toBeDefined();
    expect(parsed.$defs?.step).toBeDefined();
    expect(parsed.$defs?.participant).toBeDefined();
    expect(parsed.$defs?.ball).toBeDefined();
    expect(parsed.$defs?.drillObject).toBeDefined();
    expect(parsed.$defs?.action).toBeDefined();
  });

  it("frontend copy and Rails copy share the same structural keys", () => {
    const rails = JSON.parse(readFileSync(RAILS_SCHEMA_PATH, "utf8"));
    const frontend = JSON.parse(readFileSync(FRONTEND_SCHEMA_PATH, "utf8"));
    expect(Object.keys(frontend.$defs).sort()).toEqual(
      Object.keys(rails.$defs).sort()
    );
  });
});

