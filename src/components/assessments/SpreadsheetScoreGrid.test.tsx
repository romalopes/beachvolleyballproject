import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AssessmentSessionCategory,
  AssessmentSessionParticipant,
} from "../../api";
import SpreadsheetScoreGrid from "./SpreadsheetScoreGrid";

type ParticipantResult = NonNullable<AssessmentSessionParticipant["result"]>;

const categories: AssessmentSessionCategory[] = [
  { id: 1, label: "Attack", weight: 40, position: 0 },
  { id: 2, label: "Block", weight: 30, position: 1 },
];

const participant = (
  result?: ParticipantResult,
): AssessmentSessionParticipant => ({
  id: 1,
  player_profile_id: 1,
  player_name: "Ana Silva",
  inclusion: "included",
  missing_reason: null,
  result,
});

const resultWith = (
  categoryScores: NonNullable<ParticipantResult["category_scores"]>,
): ParticipantResult => ({
  player_profile_id: 1,
  player_name: "Ana Silva",
  assessment_id: 900,
  overall_score: 74,
  rank: 1,
  missing_category_ids: [],
  status: "complete",
  category_scores: categoryScores,
});

describe("SpreadsheetScoreGrid hydration", () => {
  it("shows the coach's saved values for a published (read-only) session", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[
          participant(
            resultWith([
              {
                assessment_category_id: 1,
                reported_value: 8,
                scale: "one_to_ten",
                score: 80,
              },
              {
                assessment_category_id: 2,
                reported_value: 6,
                scale: "one_to_ten",
                score: 60,
              },
            ]),
          ),
        ]}
        isDraft={false}
        onSaveScores={vi.fn()}
      />,
    );

    // The cells must not be blank: the total has to be explainable.
    expect(screen.getByLabelText("Ana Silva Attack")).toHaveValue("8");
    expect(screen.getByLabelText("Ana Silva Block")).toHaveValue("6");
    // And they are read-only, because the session is published.
    expect(screen.getByLabelText("Ana Silva Attack")).toBeDisabled();
  });

  it("labels a value that was entered on a different scale", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[
          participant(
            resultWith([
              {
                assessment_category_id: 1,
                reported_value: 4,
                scale: "one_to_five",
                score: 70,
              },
              {
                assessment_category_id: 2,
                reported_value: 6,
                scale: "one_to_ten",
                score: 60,
              },
            ]),
          ),
        ]}
        isDraft={false}
        onSaveScores={vi.fn()}
      />,
    );

    // 4 was entered out of 5; the badge stops it reading as 4/10.
    expect(screen.getByText("/5")).toBeInTheDocument();
    expect(screen.queryByText("/10")).not.toBeInTheDocument();
  });

  it("leaves cells blank when nothing was ever scored", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Ana Silva Attack")).toHaveValue("");
  });
});
