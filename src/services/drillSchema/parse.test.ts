import { describe, expect, it } from "vitest";
import { parseAndValidateDefinition } from "./parse";

/**
 * Text-entry coverage for the drill-definition editor helper. The point is the
 * three-way branch: blank (allowed), malformed JSON (parse error), and
 * parseable-but-schema-invalid (structural issues).
 */

/** Minimal definition that satisfies the shared v1 schema. */
const validDefinition = {
  version: 1,
  court: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "p1", type: "player" }],
  balls: [{ id: "ball1", type: "volleyball" }],
  objects: [{ id: "cone1", type: "cone" }],
  steps: [
    {
      id: "step1",
      participants: [
        { id: "p1", active: true, location: { court: "court_1", x: 2, y: 2 } },
      ],
      balls: [
        { id: "ball1", active: true, location: { court: "court_1", x: 3, y: 2 } },
      ],
      objects: [
        { id: "cone1", active: true, location: { court: "court_1", x: 4, y: 4 } },
      ],
      actions: [],
      participant_movements: [],
      ball_movements: [],
      object_movements: [],
    },
  ],
};

describe("parseAndValidateDefinition — blank input", () => {
  it("treats an empty string as valid with no definition", () => {
    const result = parseAndValidateDefinition("");
    expect(result.valid).toBe(true);
    expect(result.definition).toBeNull();
    expect(result.parseError).toBeNull();
    expect(result.issues).toHaveLength(0);
  });

  it("treats whitespace-only input as blank", () => {
    const result = parseAndValidateDefinition("   \n\t  ");
    expect(result.valid).toBe(true);
    expect(result.definition).toBeNull();
    expect(result.issues).toHaveLength(0);
  });
});

describe("parseAndValidateDefinition — malformed JSON", () => {
  it("reports a parse error and short-circuits before schema validation", () => {
    const result = parseAndValidateDefinition("{ not json");
    expect(result.valid).toBe(false);
    expect(result.definition).toBeNull();
    expect(result.parseError).toBeTruthy();
    expect(result.issues).toHaveLength(0);
  });
});

describe("parseAndValidateDefinition — schema validation", () => {
  it("accepts a structurally valid definition", () => {
    const result = parseAndValidateDefinition(JSON.stringify(validDefinition));
    expect(result.valid).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.issues).toHaveLength(0);
    expect(result.definition).toEqual(validDefinition);
  });

  it("rejects parseable JSON that fails the schema and returns issues", () => {
    const result = parseAndValidateDefinition(JSON.stringify({}));
    expect(result.valid).toBe(false);
    expect(result.parseError).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    // The parsed value is still returned so callers can inspect it.
    expect(result.definition).toEqual({});
  });

  it("rejects a top-level array", () => {
    const result = parseAndValidateDefinition("[]");
    expect(result.valid).toBe(false);
    expect(result.parseError).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects a definition with an unknown enum value", () => {
    const bad = {
      ...validDefinition,
      participants: [{ id: "p1", type: "wizard" }],
    };
    const result = parseAndValidateDefinition(JSON.stringify(bad));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.instancePath.includes("participants"))).toBe(
      true
    );
  });
});
