import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type RankingConsolidation } from "../api";
import RankingConsolidationDetail from "./RankingConsolidationDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { ...actual.api, rankingConsolidation: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);

const source = (id: number, name: string, coach: string) => ({
  assessment_session_id: id,
  name,
  coach_name: coach,
  ranking_snapshot: [],
});

const consolidation = (
  overrides: Partial<RankingConsolidation> = {},
): RankingConsolidation => ({
  id: 3,
  name: "Autumn club ranking",
  notes: "Merged after the autumn round",
  assessment_definition: { id: 5, name: "Balanced rubric" },
  session_count: 2,
  player_count: 2,
  assessment_sessions: [source(1, "First screening", "Coach Ana"), source(2, "Second screening", "Coach Bo")],
  rows: [],
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/ranking-consolidations/3"]}>
      <Routes>
        <Route
          path="/ranking-consolidations/:id"
          element={<RankingConsolidationDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.rankingConsolidation.mockResolvedValue({ ranking_consolidation: consolidation() });
});

describe("RankingConsolidationDetail", () => {
  it("renders the snapshot header and the immutable notice", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Autumn club ranking" })).toBeInTheDocument();
    expect(screen.getByText("Merged after the autumn round")).toBeInTheDocument();
    expect(screen.getByText(/permanent snapshot/i)).toBeInTheDocument();
    // A consolidation is archival: there is nothing to edit or delete.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows one column per source session with that coach's score", async () => {
    mockedApi.rankingConsolidation.mockResolvedValue({
      ranking_consolidation: consolidation({
        rows: [
          {
            player_profile_id: 11,
            player_name: "John Smith",
            coach_scores: { "1": 80, "2": 60 },
            coverage: 2,
            average_score: 70,
            rank: 1,
          },
        ],
      }),
    });
    renderPage();

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    // "First screening" also appears in the sources list, so scope to the table.
    const table = screen.getByRole("table");
    expect(within(table).getByText("First screening")).toBeInTheDocument();
    expect(within(table).getByText("Coach Ana")).toBeInTheDocument();
    expect(within(table).getByText("80")).toBeInTheDocument();
    expect(within(table).getByText("60")).toBeInTheDocument();
    expect(within(table).getByText("70")).toBeInTheDocument();
  });

  it("marks an unranked session with a dash rather than a zero", async () => {
    mockedApi.rankingConsolidation.mockResolvedValue({
      ranking_consolidation: consolidation({
        rows: [
          {
            player_profile_id: 12,
            player_name: "Pedro Alves",
            // Absent from the second session entirely.
            coach_scores: { "1": 70 },
            coverage: 1,
            average_score: 70,
            rank: 1,
          },
        ],
      }),
    });
    renderPage();

    // "Pedro Alves" also appears in the coverage list below the table.
    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("Pedro Alves")).toBeInTheDocument();
    // The one real score and the average are both 70; the session he was absent
    // from is a dash, not a zero.
    expect(within(screen.getByRole("table")).getAllByText("70")).toHaveLength(2);
    expect(within(screen.getByRole("table")).queryByText("0")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("—")).toBeInTheDocument();
    // The shortfall is stated, both inline and in the dedicated section.
    expect(screen.getByText("1/2 sessions")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /not ranked by every session/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ranked by 1 of 2")).toBeInTheDocument();
  });

  it("omits the coverage section when every player was ranked everywhere", async () => {
    mockedApi.rankingConsolidation.mockResolvedValue({
      ranking_consolidation: consolidation({
        rows: [
          {
            player_profile_id: 11,
            player_name: "John Smith",
            coach_scores: { "1": 80, "2": 60 },
            coverage: 2,
            average_score: 70,
            rank: 1,
          },
        ],
      }),
    });
    renderPage();

    await screen.findByText("John Smith");
    expect(
      screen.queryByRole("heading", { name: /not ranked by every session/i }),
    ).not.toBeInTheDocument();
  });

  it("links each source session back to the session it came from", async () => {
    renderPage();

    expect(await screen.findByRole("link", { name: "First screening" })).toHaveAttribute(
      "href",
      "/assessment-sessions/1",
    );
    expect(screen.getByRole("link", { name: "Second screening" })).toHaveAttribute(
      "href",
      "/assessment-sessions/2",
    );
  });

  it("reports a load failure rather than an empty ranking", async () => {
    mockedApi.rankingConsolidation.mockRejectedValue(new Error("API Error: 404"));
    renderPage();

    expect(await screen.findByText("API Error: 404")).toBeInTheDocument();
  });
});
