import { describe, expect, it } from "vitest";
import { SAMPLE_DRILL_DEFINITION } from "../../../drill/definition";
import { definitionToJsonText, jsonTextToDefinition } from "./drill-model";

/**
 * The drill editor keeps a `DrillDefinition` model and a JSON textarea pointing
 * at the same definition. These helpers are the only bridge between the two, so
 * the contract they must uphold is round-trip fidelity: whatever the user sees
 * as JSON must parse back into the same model the viewer renders.
 */

describe("definitionToJsonText", () => {
  it("pretty-prints the definition with two-space indentation", () => {
    expect(definitionToJsonText(SAMPLE_DRILL_DEFINITION)).toBe(
      JSON.stringify(SAMPLE_DRILL_DEFINITION, null, 2),
    );
  });
});

describe("jsonTextToDefinition", () => {
  it("returns null for blank and whitespace-only text", () => {
    expect(jsonTextToDefinition("")).toBeNull();
    expect(jsonTextToDefinition("   \n\t ")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(jsonTextToDefinition("{ nope")).toBeNull();
  });

  it("parses any valid JSON value", () => {
    expect(jsonTextToDefinition('{ "version": 1 }')).toEqual({ version: 1 });
  });

  it("ignores surrounding whitespace", () => {
    expect(jsonTextToDefinition('  \n { "version": 1 } \n ')).toEqual({
      version: 1,
    });
  });
});

describe("definition ↔ JSON text round-trip", () => {
  it("reconstructs the model from its serialised form", () => {
    const text = definitionToJsonText(SAMPLE_DRILL_DEFINITION);
    expect(jsonTextToDefinition(text)).toEqual(SAMPLE_DRILL_DEFINITION);
  });

  it("is idempotent across repeated rounds", () => {
    const once = definitionToJsonText(SAMPLE_DRILL_DEFINITION);
    const twice = definitionToJsonText(jsonTextToDefinition(once)!);
    expect(twice).toBe(once);
  });
});