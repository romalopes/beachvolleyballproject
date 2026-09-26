import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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


describe("SpreadsheetScoreGrid editing", () => {
  const twoPlayers = [
    participant(),
    {
      id: 2,
      player_profile_id: 2,
      player_name: "Bruno Alves",
      inclusion: "included" as const,
      missing_reason: null,
    },
  ];

  it("moves down a column and across a row with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={twoPlayers}
        isDraft
        onSaveScores={vi.fn()}
      />,
    );

    const anaAttack = screen.getByLabelText("Ana Silva Attack");
    anaAttack.focus();
    expect(anaAttack).toHaveFocus();

    // Down to the next player, same category.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("Bruno Alves Attack")).toHaveFocus();

    // Back up, then right to the next category.
    await user.keyboard("{ArrowUp}{ArrowRight}");
    expect(screen.getByLabelText("Ana Silva Block")).toHaveFocus();
  });

  it("stops at the grid edges instead of wrapping", async () => {
    const user = userEvent.setup();
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={vi.fn()}
      />,
    );

    const anaAttack = screen.getByLabelText("Ana Silva Attack");
    anaAttack.focus();

    await user.keyboard("{ArrowUp}");
    expect(anaAttack).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(anaAttack).toHaveFocus();
  });

  it("sends the coach's own entry on the selected scale, not a canonical score", async () => {
    const user = userEvent.setup();
    const onSaveScores = vi.fn().mockResolvedValue(undefined);
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={onSaveScores}
      />,
    );

    await user.type(screen.getByLabelText("Ana Silva Attack"), "8");
    await user.type(screen.getByLabelText("Ana Silva Block"), "6");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSaveScores).toHaveBeenCalled());
    // value is the typed entry; the server owns the conversion and the total.
    expect(onSaveScores).toHaveBeenCalledWith([
      {
        player_profile_id: 1,
        category_scores: [
          { assessment_category_id: 1, scale: "one_to_ten", value: 8 },
          { assessment_category_id: 2, scale: "one_to_ten", value: 6 },
        ],
      },
    ]);
  });

  it("refuses an off-scale value before it can be sent", async () => {
    const user = userEvent.setup();
    const onSaveScores = vi.fn();
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={onSaveScores}
      />,
    );

    // 11 is legal on 1-100 but not on the default 1-10 scale. The cell is flagged
    // for the coach and the whole submit is blocked, so a bad value cannot reach
    // the server as part of a batch.
    await user.type(screen.getByLabelText("Ana Silva Attack"), "11");
    expect(screen.getByLabelText("Ana Silva Attack")).toHaveClass("invalid");

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Invalid value "11" for Ana Silva in Attack/i,
    );
    expect(onSaveScores).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection and keeps the typed values", async () => {
    const user = userEvent.setup();
    const onSaveScores = vi
      .fn()
      .mockRejectedValue(new Error("Score every included player before publishing"));
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={onSaveScores}
      />,
    );

    const cell = screen.getByLabelText("Ana Silva Attack");
    await user.type(cell, "8");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Score every included player before publishing",
    );
    // A failed save must not wipe the coach's work.
    expect(cell).toHaveValue("8");
  });

  it("keeps Save disabled until something is typed", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /scores saved/i })).toBeDisabled();
  });

  it("refuses to send an empty payload after the coach clears their entry", async () => {
    const user = userEvent.setup();
    const onSaveScores = vi.fn();
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft
        onSaveScores={onSaveScores}
      />,
    );

    const cell = screen.getByLabelText("Ana Silva Attack");
    await user.type(cell, "8");
    await user.clear(cell);

    // The grid is dirty (edited) but holds nothing to send.
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No scores entered to save/i,
    );
    expect(onSaveScores).not.toHaveBeenCalled();
  });

  it("tells the coach when there is nobody to score", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[
          {
            id: 9,
            player_profile_id: 9,
            player_name: "Evan Souza",
            inclusion: "excluded",
            missing_reason: "Absent",
          },
        ]}
        isDraft
        onSaveScores={vi.fn()}
      />,
    );

    // An excluded player must not get a scoreable row (D21).
    expect(screen.queryByLabelText("Evan Souza Attack")).not.toBeInTheDocument();
    expect(screen.getByText(/No included players on the roster/i)).toBeInTheDocument();
  });

  it("locks editing when the session is published", () => {
    render(
      <SpreadsheetScoreGrid
        categories={categories}
        participants={[participant()]}
        isDraft={false}
        onSaveScores={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Ana Silva Attack")).toBeDisabled();
    expect(screen.getByLabelText("Rating scale:")).toBeDisabled();
  });
});
