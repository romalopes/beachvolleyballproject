import { describe, expect, it } from "vitest";
import { describe as describeRating } from "./rating";

describe("describe", () => {
  const matrix = [0, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 99, 100];
  const tens = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10];
  const fives = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5];

  it("matches the canonical 21-row matrix and is monotonic", () => {
    matrix.forEach((score, index) => {
      expect(describeRating(score)).toBe(`${score}/100 · ${tens[index]}/10 · ${fives[index]}/5`);
    });
  });

  it("keeps an unrated draft unrated", () => {
    expect(describeRating(null)).toBe("Not rated yet");
  });
});
