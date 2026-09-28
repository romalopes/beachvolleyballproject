import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type AssessmentSessionStatus,
  type RankingConsolidation,
} from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import RankingConsolidationDetail from "./RankingConsolidationDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      rankingConsolidation: vi.fn(),
      publishRankingConsolidation: vi.fn(),
      withdrawRankingConsolidation: vi.fn(),
      recalculateRankingConsolidation: vi.fn(),
      restoreRankingConsolidation: vi.fn(),
      deleteRankingConsolidation: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

// `incompletePlayers` defaults to none: a source session that left players
// unfinished passes their names so the D21 warning banner can list them.
// `status` defaults to published; a draft source is what blocks publishing.
// `includedInRanking` defaults to true — scores on screen — and is only false for a
// source the server says the merge actually skipped. That is the whole point of the
// field: a withdrawn session is *not* automatically out of a published ranking.
const source = (
  id: number,
  name: string,
  coach: string,
  incompletePlayers: string[] = [],
  status: AssessmentSessionStatus = "published",
  includedInRanking = true,
) => ({
  assessment_session_id: id,
  name,
  coach_name: coach,
  status,
  status_label: status === "published" ? "Published" : status === "draft" ? "Draft" : "Withdrawn",
  incomplete_count: incompletePlayers.length,
  incomplete_players: incompletePlayers,
  included_in_ranking: includedInRanking,
  withdrawn_at: status === "withdrawn" ? "2026-09-28T10:00:00Z" : null,
  ranking_snapshot: [],
});

const consolidation = (
  overrides: Partial<RankingConsolidation> = {},
): RankingConsolidation => ({
  id: 3,
  name: "Autumn club ranking",
  notes: "Merged after the autumn round",
  status: "published",
  status_label: "Published",
  published_at: "2026-09-27T09:46:00Z",
  unpublished_session_count: 0,
  withdrawn_session_count: 0,
  stale_withdrawn_session_count: 0,
  excluded_withdrawn_session_count: 0,
  computed_at: "2026-09-27T09:46:00Z",
  recalculated_at: null,
  recalculable: false,
  can_recalculate: false,
  assessment_definition: { id: 5, name: "Balanced rubric" },
  session_count: 2,
  player_count: 2,
  source_warnings: [],
  assessment_sessions: [source(1, "First screening", "Coach Ana"), source(2, "Second screening", "Coach Bo")],
  rows: [],
  ...overrides,
});

// The page reads the signed-in user to decide which controls to offer, so tests
// supply a context value directly. `user: null` is the default: a non-admin, which
// is what most of these tests are.
const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
  ...overrides,
});

const adminUser = {
  id: 1,
  email: "admin@example.com",
  roles: ["admin"],
} as unknown as AuthContextValue["user"];

const renderPage = (auth: AuthContextValue = authValue()) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/ranking-consolidations/3"]}>
        <Routes>
          <Route
            path="/ranking-consolidations/:id"
            element={<RankingConsolidationDetail />}
          />
          {/* So a successful delete has somewhere to land. */}
          <Route
            path="/ranking-consolidations"
            element={<div>All consolidations</div>}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
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
    // Published and archival: the only action offered is the reversible
    // withdrawal. There is no permanent delete, and none of the editing a draft
    // would allow.
    expect(screen.getByRole("button", { name: /withdraw ranking/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete permanently/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /publish ranking/i }),
    ).not.toBeInTheDocument();
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

  it("names the sessions that had incomplete scores in a warning banner", async () => {
    mockedApi.rankingConsolidation.mockResolvedValue({
      ranking_consolidation: consolidation({
        source_warnings: [
          {
            assessment_session_id: 2,
            name: "Second screening",
            incomplete_count: 1,
            incomplete_players: ["Diego Costa"],
          },
        ],
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          source(2, "Second screening", "Coach Bo", ["Diego Costa"]),
        ],
        rows: [],
      }),
    });
    renderPage();

    // D21 never blocks the merge, so the reason it proceeded is what gets shown.
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(
      "Some source sessions had incomplete scores and were merged anyway.",
    );
    expect(banner).toHaveTextContent("Second screening");
    expect(banner).toHaveTextContent("1 incomplete: Diego Costa");
    expect(banner).toHaveTextContent("rather than counted as zero");
  });

  it("omits the warning banner when no source session was incomplete", async () => {
    renderPage();

    await screen.findByRole("table");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  describe("publication", () => {
    it("offers no publish button on a published ranking", async () => {
      renderPage();

      await screen.findByRole("table");
      expect(
        screen.queryByRole("button", { name: /publish ranking/i }),
      ).not.toBeInTheDocument();
    });

    it("disables publishing and names the sessions holding a draft back", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
          unpublished_session_count: 1,
          assessment_sessions: [
            source(1, "First screening", "Coach Ana"),
            source(2, "Second screening", "Coach Bo", [], "draft"),
          ],
        }),
      });
      renderPage();

      const button = await screen.findByRole("button", { name: /publish ranking/i });
      expect(button).toBeDisabled();
      // The coach is told which session to finish, not just that it failed. The
      // name also appears as a table header, so the note itself is matched.
      const note = screen.getByText(/still unfinished/).closest("span");
      expect(note).toHaveTextContent("Second screening");
      expect(note).toHaveTextContent("Second screening is still unfinished");
    });

    it("publishes a draft once every source session is published", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
          unpublished_session_count: 0,
        }),
      });
      mockedApi.publishRankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation(),
      });
      renderPage();

      const button = await screen.findByRole("button", { name: /publish ranking/i });
      expect(button).toBeEnabled();
      await userEvent.click(button);

      expect(mockedApi.publishRankingConsolidation).toHaveBeenCalledWith(3);
      // The response replaces the draft, so the button disappears and the page
      // reports the frozen state.
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /publish ranking/i }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByText(/frozen at publication/)).toBeInTheDocument();
    });

    it("surfaces a refusal and keeps the ranking a draft", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
          unpublished_session_count: 0,
        }),
      });
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
          unpublished_session_count: 0,
        }),
      });
      mockedApi.publishRankingConsolidation.mockRejectedValue(
        new Error('Session "Second screening" is draft, not published'),
      );
      renderPage();

      await userEvent.click(
        await screen.findByRole("button", { name: /publish ranking/i }),
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Second screening");
      // Still a draft: a refused publish must not look like a published one.
      expect(
        screen.getByRole("button", { name: /publish ranking/i }),
      ).toBeInTheDocument();
    });
  });

  describe("withdrawn source sessions", () => {
    const withWithdrawnSource = (overrides: Partial<RankingConsolidation> = {}) =>
      consolidation({
        status: "draft",
        status_label: "Draft",
        published_at: null,
        unpublished_session_count: 0,
        withdrawn_session_count: 1,
        // The author is signed in, so the notice is shown to them. A draft has no
        // frozen snapshot yet, so a withdrawn source is genuinely excluded from it —
        // which is what `included_in_ranking: false` reports.
        created_by_id: 7,
        excluded_withdrawn_session_count: 1,
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          source(2, "Retracted screening", "Coach Bo", [], "withdrawn", false),
        ],
        ...overrides,
      });

    const author = {
      id: 7,
      email: "coach@example.com",
      roles: ["coach"],
    } as unknown as AuthContextValue["user"];

    it("does not hold up publishing", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withWithdrawnSource(),
      });
      renderPage(authValue({ user: author }));

      // A withdrawn source contributes no scores, so it is not a blocker: the
      // button is enabled even though no source is a draft any more.
      const button = await screen.findByRole("button", { name: /publish ranking/i });
      expect(button).toBeEnabled();
    });

    it("tells the author which source was left out, and that it is still listed", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withWithdrawnSource(),
      });
      renderPage(authValue({ user: author }));

      const notice = await screen.findByText(/withdrawn before this ranking was computed/i);
      expect(notice).toHaveTextContent("1 source session was withdrawn");
      const banner = notice.closest(".consolidation-withdrawn-banner");
      expect(banner).toHaveTextContent("Retracted screening");
      expect(banner).toHaveTextContent("Withdrawn by Coach Bo");
      // Explicit, because "left out" could otherwise read as "removed".
      expect(banner).toHaveTextContent("still listed as a source");
      expect(banner).toHaveTextContent("does not hold up publication");
    });

    it("does not badge a player as under-covered because of a withdrawn source", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withWithdrawnSource({
          rows: [
            {
              player_profile_id: 1,
              player_name: "John Silva",
              coach_scores: { "1": 80 },
              coverage: 1,
              average_score: 80,
              rank: 1,
            },
          ],
        }),
      });
      renderPage(authValue({ user: author }));

      await screen.findByRole("table");
      // Coverage is measured against contributing sources only, so 1 of 1 is full
      // coverage and no badge is shown.
      expect(screen.queryByText(/1\/1 sessions/)).not.toBeInTheDocument();
      expect(screen.getByText("John Silva")).toBeInTheDocument();
    });

    it("hides the notice from a coach who is neither the author nor oversight", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withWithdrawnSource({ created_by_id: 99 }),
      });
      renderPage();

      await screen.findByRole("table");
      expect(
        screen.queryByText(/withdrawn before this ranking was computed/i),
      ).not.toBeInTheDocument();
    });

    it("shows the notice to a curator who did not author the ranking", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withWithdrawnSource({ created_by_id: 99 }),
      });
      renderPage(
        authValue({
          user: { id: 3, email: "cur@example.com", roles: ["curator"] } as never,
        }),
      );

      expect(
        await screen.findByText(/withdrawn before this ranking was computed/i),
      ).toBeInTheDocument();
    });
  });

  describe("a source withdrawn after publication", () => {
    // The case that used to be wrong: a frozen ranking whose source was retracted
    // afterwards. Its scores are STILL in the figures, so the page must not describe
    // the session as excluded, must not drop it from the coverage denominator, and
    // must not blank its column.
    const withStaleSource = (overrides: Partial<RankingConsolidation> = {}) =>
      consolidation({
        published_at: "2026-09-27T09:46:00Z",
        computed_at: "2026-09-27T09:46:00Z",
        withdrawn_session_count: 1,
        stale_withdrawn_session_count: 1,
        excluded_withdrawn_session_count: 0,
        created_by_id: 7,
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          // Withdrawn, yet still contributing: `included_in_ranking` is true.
          source(2, "Retracted screening", "Coach Bo", [], "withdrawn", true),
        ],
        rows: [
          {
            player_profile_id: 1,
            player_name: "John Silva",
            // Scored by both sessions, including the retracted one.
            coach_scores: { "1": 80, "2": 20 },
            coverage: 2,
            average_score: 50,
            rank: 1,
          },
        ],
        ...overrides,
      });

    const author = {
      id: 7,
      email: "coach@example.com",
      roles: ["coach"],
    } as unknown as AuthContextValue["user"];

    it("says the scores are still counted rather than claiming they were left out", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withStaleSource(),
      });
      renderPage(authValue({ user: author }));

      const notice = await screen.findByText(
        /withdrawn after this ranking was published/i,
      );
      const banner = notice.closest(".consolidation-withdrawn-banner");
      expect(banner).toHaveTextContent("Retracted screening");
      expect(banner).toHaveTextContent("scores are still counted in it");
      // Explicitly *not* the "left out" wording, which would misdescribe the figures.
      expect(banner).not.toHaveTextContent(/left out of this ranking/i);
      expect(banner).not.toHaveTextContent(/already excluded/i);
      // And it says why: publication does not cascade.
      expect(banner).toHaveTextContent("Publishing does not cascade");
    });

    it("keeps the withdrawn source in the coverage denominator", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withStaleSource(),
      });
      renderPage(authValue({ user: author }));

      await screen.findByRole("table");
      // 2 of 2 is full coverage, so no shortfall badge — the retracted session really
      // did rank this player.
      expect(screen.queryByText(/\d\/2 sessions/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ranked by \d+ of 2/)).not.toBeInTheDocument();
    });

    it("still shows the retracted session's score rather than blanking it", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withStaleSource(),
      });
      renderPage(authValue({ user: author }));

      const table = within(await screen.findByRole("table"));
      // The 20 is on screen and in the average, so it must not be hidden behind a dash.
      expect(table.getAllByText("20")).toHaveLength(1);
      expect(table.queryByText("—")).not.toBeInTheDocument();
      expect(table.getByText("50")).toBeInTheDocument();
    });

    it("offers no recalculation to a plain coach, and says who can", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withStaleSource({
          recalculable: true,
          can_recalculate: false,
        }),
      });
      renderPage(authValue({ user: author }));

      const notice = await screen.findByText(
        /withdrawn after this ranking was published/i,
      );
      expect(
        screen.queryByRole("button", { name: /recalculate/i }),
      ).not.toBeInTheDocument();
      expect(notice.closest(".consolidation-withdrawn-banner")).toHaveTextContent(
        /curator or admin can recalculate/i,
      );
    });
  });

  describe("recalculating a published ranking", () => {
    const curator = {
      id: 3,
      email: "cur@example.com",
      roles: ["curator"],
    } as unknown as AuthContextValue["user"];

    // Published, one source retracted after the freeze, and the viewer may correct it.
    const recalculable = (overrides: Partial<RankingConsolidation> = {}) =>
      consolidation({
        published_at: "2026-09-27T09:46:00Z",
        computed_at: "2026-09-27T09:46:00Z",
        withdrawn_session_count: 1,
        stale_withdrawn_session_count: 1,
        recalculable: true,
        can_recalculate: true,
        created_by_id: 7,
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          source(2, "Retracted screening", "Coach Bo", [], "withdrawn", true),
        ],
        rows: [
          {
            player_profile_id: 1,
            player_name: "John Silva",
            coach_scores: { "1": 80, "2": 20 },
            coverage: 2,
            average_score: 50,
            rank: 1,
          },
        ],
        ...overrides,
      });

    // The corrected ranking: the source is now genuinely out, so the average is 80
    // over one session and the notice flips to "already excluded".
    const recalculatedRanking = () =>
      recalculable({
        stale_withdrawn_session_count: 0,
        excluded_withdrawn_session_count: 1,
        recalculable: false,
        can_recalculate: false,
        recalculated_at: "2026-09-29T08:00:00Z",
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          source(2, "Retracted screening", "Coach Bo", [], "withdrawn", false),
        ],
        rows: [
          {
            player_profile_id: 1,
            player_name: "John Silva",
            coach_scores: { "1": 80 },
            coverage: 1,
            average_score: 80,
            rank: 1,
          },
        ],
      });

    it("offers a curator the action and explains what it preserves", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculable(),
      });
      renderPage(authValue({ user: curator }));

      const notice = await screen.findByText(
        /withdrawn after this ranking was published/i,
      );
      const banner = notice.closest(".consolidation-withdrawn-banner");
      expect(
        within(banner as HTMLElement).getByRole("button", { name: /recalculate/i }),
      ).toBeInTheDocument();
      // The action explains itself: the publication date is kept, the change recorded.
      expect(banner).toHaveTextContent(/original publication date is kept/i);
    });

    it("recalculates and shows the corrected figures", async () => {
      mockedApi.recalculateRankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculatedRanking(),
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculable(),
      });
      renderPage(authValue({ user: curator }));

      await userEvent.click(
        await screen.findByRole("button", { name: /recalculate/i }),
      );

      expect(mockedApi.recalculateRankingConsolidation).toHaveBeenCalledWith(3);
      // The stale notice is gone, replaced by the "already excluded" one.
      await screen.findByText(/withdrawn before this ranking was computed/i);
      expect(
        screen.queryByText(/scores are still counted in it/i),
      ).not.toBeInTheDocument();
      // The correction is spent, so the action must not still be on screen.
      expect(
        screen.queryByRole("button", { name: /recalculate/i }),
      ).not.toBeInTheDocument();
      const table = within(await screen.findByRole("table"));
      // The retracted session's 20 is gone and the average is January's 80 alone.
      expect(table.getAllByText("80").length).toBeGreaterThan(0);
      expect(table.queryByText("20")).not.toBeInTheDocument();
      expect(table.queryByText("50")).not.toBeInTheDocument();
      confirmSpy.mockRestore();
    });

    it("confirms before rewriting, naming what will be removed", async () => {
      mockedApi.recalculateRankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculatedRanking(),
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculable(),
      });
      renderPage(authValue({ user: curator }));

      await userEvent.click(
        await screen.findByRole("button", { name: /recalculate/i }),
      );

      // It is a correction to a result people may have acted on, so it names the
      // session that goes and says the publication date survives.
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("Retracted screening"),
      );
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("original publication date is kept"),
      );
      confirmSpy.mockRestore();
    });

    it("offers the action again when a source is retracted after the correction", async () => {
      // The control is hidden because the correction is *spent*, not because
      // recalculation is a once-ever privilege. A session retracted afterwards is
      // stale all over again, and there is genuinely something to correct — so the
      // action must come back. Hiding it on `recalculated_at` alone would be wrong.
      const retractedAgain = {
        ...recalculatedRanking(),
        stale_withdrawn_session_count: 1,
        excluded_withdrawn_session_count: 0,
        recalculable: true,
        can_recalculate: true,
        assessment_sessions: [
          source(1, "First screening", "Coach Ana"),
          source(2, "Retracted screening", "Coach Bo", [], "withdrawn", true),
        ],
      };
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: retractedAgain as RankingConsolidation,
      });
      renderPage(authValue({ user: curator }));

      expect(
        await screen.findByRole("button", { name: /recalculate/i }),
      ).toBeInTheDocument();
    });

    it("changes nothing when the confirmation is declined", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculable(),
      });
      renderPage(authValue({ user: curator }));

      await userEvent.click(
        await screen.findByRole("button", { name: /recalculate/i }),
      );

      expect(mockedApi.recalculateRankingConsolidation).not.toHaveBeenCalled();
      // Untouched, so the notice still says the scores are counted.
      expect(
        await screen.findByText(/scores are still counted in it/i),
      ).toBeInTheDocument();
      confirmSpy.mockRestore();
    });

    it("surfaces a refusal from the server instead of pretending it worked", async () => {
      // Somebody else recalculated first, so there is nothing left to correct.
      mockedApi.recalculateRankingConsolidation.mockRejectedValue(
        new Error(
          "There is nothing to recalculate — no source was withdrawn after this ranking was published",
        ),
      );
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: recalculable(),
      });
      renderPage(authValue({ user: curator }));

      await userEvent.click(
        await screen.findByRole("button", { name: /recalculate/i }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /nothing to recalculate/i,
      );
      // The figures on screen are unchanged, because nothing was recalculated.
      expect(
        await screen.findByText(/scores are still counted in it/i),
      ).toBeInTheDocument();
      confirmSpy.mockRestore();
    });
  });

  describe("withdrawal and restore", () => {
    const withdrawn = (overrides: Partial<RankingConsolidation> = {}) =>
      consolidation({
        status: "withdrawn",
        status_label: "Withdrawn",
        published_at: null,
        ...overrides,
      });

    it("withdraws a published ranking and reports it as withdrawn", async () => {
      mockedApi.withdrawRankingConsolidation.mockResolvedValue({
        ranking_consolidation: withdrawn(),
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();

      await userEvent.click(
        await screen.findByRole("button", { name: /withdraw ranking/i }),
      );

      expect(mockedApi.withdrawRankingConsolidation).toHaveBeenCalledWith(3);
      await screen.findByText(/was withdrawn and is no longer/);
      confirmSpy.mockRestore();
    });

    it("keeps the ranking when the withdrawal is cancelled", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      renderPage();

      await userEvent.click(
        await screen.findByRole("button", { name: /withdraw ranking/i }),
      );

      expect(mockedApi.withdrawRankingConsolidation).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    // The admin-only rule is a real boundary, so a non-admin must not even be
    // offered the restore or the irreversible delete.
    it("offers a non-admin neither restore nor delete on a withdrawn ranking", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withdrawn(),
      });
      renderPage();

      await screen.findByText(/was withdrawn and is no longer/);
      expect(
        screen.queryByRole("button", { name: /restore to published/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /delete permanently/i }),
      ).not.toBeInTheDocument();
    });

    it("offers an admin both restores and a delete on a withdrawn ranking", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withdrawn(),
      });
      renderPage(authValue({ user: adminUser }));

      expect(
        await screen.findByRole("button", { name: /restore to published/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /restore to draft/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete permanently/i }),
      ).toBeInTheDocument();
    });

    it("restores a withdrawn ranking to published, which re-derives it", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withdrawn(),
      });
      mockedApi.restoreRankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation(),
      });
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: /restore to published/i }),
      );

      expect(mockedApi.restoreRankingConsolidation).toHaveBeenCalledWith(3, "published");
      await screen.findByText(/permanent snapshot/i);
    });

    it("keeps the ranking withdrawn when a restore is refused", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: withdrawn(),
      });
      mockedApi.restoreRankingConsolidation.mockRejectedValue(
        new Error('Session "Second screening" is draft, not published'),
      );
      renderPage(authValue({ user: adminUser }));

      await userEvent.click(
        await screen.findByRole("button", { name: /restore to published/i }),
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Second screening");
      // Still withdrawn: a refused restore must not look like a published one.
      expect(
        screen.getByRole("button", { name: /restore to published/i }),
      ).toBeInTheDocument();
    });

    it("deletes a draft ranking and returns to the list", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
          unpublished_session_count: 0,
        }),
      });
      mockedApi.deleteRankingConsolidation.mockResolvedValue({
        message: "Ranking consolidation deleted",
        id: 3,
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();

      await userEvent.click(
        await screen.findByRole("button", { name: /delete permanently/i }),
      );

      expect(mockedApi.deleteRankingConsolidation).toHaveBeenCalledWith(3);
      await screen.findByText("All consolidations");
      confirmSpy.mockRestore();
    });

    it("does not delete when the confirmation is cancelled", async () => {
      mockedApi.rankingConsolidation.mockResolvedValue({
        ranking_consolidation: consolidation({
          status: "draft",
          status_label: "Draft",
          published_at: null,
        }),
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      renderPage();

      await userEvent.click(
        await screen.findByRole("button", { name: /delete permanently/i }),
      );

      expect(mockedApi.deleteRankingConsolidation).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});
