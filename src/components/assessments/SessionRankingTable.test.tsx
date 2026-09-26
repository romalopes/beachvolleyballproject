import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  AssessmentSessionCategory,
  AssessmentSessionRankingRow,
} from "../../api";
import SessionRankingTable from "./SessionRankingTable";

const categories: AssessmentSessionCategory[] = [
  { id: 1, label: "Attack", weight: 40, position: 0 },
  { id: 2, label: "Block", weight: 30, position: 1 },
];

const row = (
  overrides: Partial<AssessmentSessionRankingRow> = {},
): AssessmentSessionRankingRow => ({
  player_profile_id: 1,
  player_name: "Ana Silva",
  assessment_id: 900,
  overall_score: 80,
  rank: 1,
  missing_category_ids: [],
  status: "complete",
  ...overrides,
});

const renderTable = (payload: {
  ranking?: AssessmentSessionRankingRow[];
  incomplete?: AssessmentSessionRankingRow[];
  excluded?: AssessmentSessionRankingRow[];
}) =>
  render(
    <SessionRankingTable
      categories={categories}
      rankingPayload={{
        ranking: payload.ranking ?? [],
        incomplete: payload.incomplete ?? [],
        excluded: payload.excluded ?? [],
      }}
    />,
  );

describe("SessionRankingTable", () => {
  it("ranks players by overall score", () => {
    renderTable({
      ranking: [
        row({ player_profile_id: 1, player_name: "Ana Silva", overall_score: 88, rank: 1 }),
        row({ player_profile_id: 2, player_name: "Bruno Alves", overall_score: 72, rank: 2 }),
      ],
    });

    expect(screen.getByText("Official Ranking (2)")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("Bruno Alves")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows tied ranks as sent by the server (competition ranking)", () => {
    // The server owns the rank; the table must not recompute or renumber it.
    renderTable({
      ranking: [
        row({ player_profile_id: 1, player_name: "Ana Silva", overall_score: 81, rank: 1 }),
        row({ player_profile_id: 2, player_name: "Bruno Alves", overall_score: 81, rank: 1 }),
        row({ player_profile_id: 3, player_name: "Carla Dias", overall_score: 60, rank: 3 }),
      ],
    });

    expect(screen.getAllByText("#1")).toHaveLength(2);
    expect(screen.getByText("#3")).toBeInTheDocument();
    // No rank 2 exists under competition ranking, and the table must not invent one.
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  it("names the missing categories for an incomplete player", () => {
    renderTable({
      incomplete: [
        row({
          player_profile_id: 4,
          player_name: "Dina Reis",
          overall_score: null,
          rank: null,
          status: "incomplete",
          missing_category_ids: [1, 2],
        }),
      ],
    });

    expect(
      screen.getByText("Incomplete / Missing Categories (1)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing: Attack, Block/)).toBeInTheDocument();
  });

  it("falls back to a generic label for an unknown category id", () => {
    renderTable({
      incomplete: [
        row({
          player_name: "Dina Reis",
          status: "incomplete",
          missing_category_ids: [99],
        }),
      ],
    });

    expect(screen.getByText(/Missing: Category #99/)).toBeInTheDocument();
  });

  it("keeps excluded players out of the ranking and shows the reason", () => {
    renderTable({
      ranking: [row({ player_name: "Ana Silva" })],
      excluded: [
        row({
          player_profile_id: 5,
          player_name: "Evan Souza",
          status: "excluded",
          overall_score: null,
          rank: null,
          missing_reason: "Injured knee, not observed.",
        }),
      ],
    });

    expect(screen.getByText("Excluded Players (1)")).toBeInTheDocument();
    expect(screen.getByText(/Injured knee, not observed\./)).toBeInTheDocument();
    // A deliberate absentee must not appear as a ranked result: the ranking
    // table holds the one genuinely-scored player and nobody else.
    const table = document.querySelector(".session-ranking-table");
    expect(table).toHaveTextContent("Ana Silva");
    expect(table).not.toHaveTextContent("Evan Souza");
  });

  it("never invents a zero for an unscored player", () => {
    renderTable({
      incomplete: [
        row({
          player_name: "Dina Reis",
          overall_score: null,
          rank: null,
          status: "incomplete",
          missing_category_ids: [1],
        }),
      ],
    });

    expect(screen.getByText("Dina Reis")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("explains an empty session", () => {
    renderTable({});
    expect(screen.getByText("No players on the session roster yet.")).toBeInTheDocument();
  });

  it("explains when the roster exists but nothing is scored yet", () => {
    renderTable({
      ranking: [],
      incomplete: [row({ player_name: "Ana Silva", status: "incomplete" })],
    });
    expect(
      screen.getByText(/No complete ratings recorded yet/i),
    ).toBeInTheDocument();
  });
});
