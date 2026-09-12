import { describe, expect, it } from "vitest";
import {
  idealLabel,
  isValidDrillRange,
  playerRangeLabel,
  trainingStageLabel,
} from "./drills";

const valid = {
  min_players: 2,
  max_players: 6,
  ideal_num_players: 4,
  training_stage: "middle",
  difficulty_level: "intermediate",
};

describe("isValidDrillRange", () => {
  it("accepts a fully valid drill range", () => {
    expect(isValidDrillRange(valid)).toBe(true);
  });

  it("accepts boundary values where min == max == ideal", () => {
    expect(
      isValidDrillRange({
        ...valid,
        min_players: 2,
        max_players: 2,
        ideal_num_players: 2,
      })
    ).toBe(true);
  });

  it("rejects non-integer player counts", () => {
    expect(isValidDrillRange({ ...valid, min_players: 2.5 })).toBe(false);
    expect(isValidDrillRange({ ...valid, max_players: "6" })).toBe(false);
    expect(isValidDrillRange({ ...valid, ideal_num_players: null })).toBe(false);
  });

  it("rejects counts below one", () => {
    expect(isValidDrillRange({ ...valid, min_players: 0 })).toBe(false);
    expect(isValidDrillRange({ ...valid, max_players: 0 })).toBe(false);
    expect(isValidDrillRange({ ...valid, ideal_num_players: 0 })).toBe(false);
  });

  it("rejects min greater than max", () => {
    expect(
      isValidDrillRange({ ...valid, min_players: 8, max_players: 4 })
    ).toBe(false);
  });

  it("rejects an ideal count outside the min/max range", () => {
    expect(isValidDrillRange({ ...valid, ideal_num_players: 1 })).toBe(false);
    expect(isValidDrillRange({ ...valid, ideal_num_players: 7 })).toBe(false);
  });

  it("rejects unknown training stages and difficulty levels", () => {
    expect(isValidDrillRange({ ...valid, training_stage: "halftime" })).toBe(
      false
    );
    expect(isValidDrillRange({ ...valid, difficulty_level: "expert" })).toBe(
      false
    );
  });

  it("accepts every documented stage and difficulty", () => {
    for (const stage of ["warmup", "beginning", "middle", "end"]) {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        expect(
          isValidDrillRange({
            ...valid,
            training_stage: stage,
            difficulty_level: level,
          })
        ).toBe(true);
      }
    }
  });
});

describe("label helpers", () => {
  it("singularizes the player range when min equals max", () => {
    expect(playerRangeLabel(4, 4)).toBe("4 players");
  });

  it("renders a range with an en dash when min differs from max", () => {
    expect(playerRangeLabel(2, 6)).toBe("2–6 players");
  });

  it("maps training stages to human labels, including Warm-up", () => {
    expect(trainingStageLabel("warmup")).toBe("Warm-up");
    expect(trainingStageLabel("beginning")).toBe("Beginning");
    expect(trainingStageLabel("middle")).toBe("Middle");
    expect(trainingStageLabel("end")).toBe("End");
  });

  it("formats the ideal player count", () => {
    expect(idealLabel(4)).toBe("Ideal: 4");
  });
});
