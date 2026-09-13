import { describe, expect, it } from "vitest";
import { SAMPLE_DRILL_DEFINITION } from "./definition";
import { validateDrillDefinition } from "../../services/drillSchema/validator";

/**
 * The sample doubles as the "load sample" starting point for authors and as
 * the fallback definition rendered by the viewer. It must therefore satisfy
 * the same shared v1 schema contract that Rails enforces on save — a previous
 * revision of the sample omitted required movement arrays and shipped invalid.
 */
describe("SAMPLE_DRILL_DEFINITION", () => {
  it("satisfies the shared v1 schema", () => {
    const result = validateDrillDefinition(SAMPLE_DRILL_DEFINITION);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("carries a definition-level description", () => {
    expect(SAMPLE_DRILL_DEFINITION.description).toBeTruthy();
  });

  it("declares every movement array on every step (may be empty, not omitted)", () => {
    for (const step of SAMPLE_DRILL_DEFINITION.steps) {
      expect(Array.isArray(step.participant_movements)).toBe(true);
      expect(Array.isArray(step.ball_movements)).toBe(true);
      expect(Array.isArray(step.object_movements)).toBe(true);
    }
  });
});
