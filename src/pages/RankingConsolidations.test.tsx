import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type AssessmentSession,
  type RankingConsolidation,
} from "../api";
import RankingConsolidations from "./RankingConsolidations";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      rankingConsolidations: vi.fn(),
      assessmentSessions: vi.fn(),
      createRankingConsolidation: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const definition = { id: 5, name: "Balanced rubric", status: "active" as const };

const session = (overrides: Partial<AssessmentSession> = {}): AssessmentSession =>
  ({
    id: 1,
    name: "Autumn screening",
    status: "published",
    status_label: "Published",
    scheduled_on: "2026-09-20",
    created_by_id: 2,
    coach_profile_id: 7,
    coach_profile: { id: 7, full_name: "Coach Ana" },
    assessment_definition: { ...definition, assessment_categories: [] },
    ranking: { ranking: [], incomplete: [], excluded: [] },
    participants: [],
    ...overrides,
  }) as AssessmentSession;

const consolidation = (
  overrides: Partial<RankingConsolidation> = {},
): RankingConsolidation => ({
  id: 3,
  name: "Autumn club ranking",
  notes: null,
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
  assessment_sessions: [],
  rows: [],
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <RankingConsolidations />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.rankingConsolidations.mockResolvedValue({ ranking_consolidations: [] });
  mockedApi.assessmentSessions.mockResolvedValue({ assessment_sessions: [] });
});

describe("RankingConsolidations", () => {
  it("explains that a consolidation needs published sessions when none exist", async () => {
    renderPage();
    expect(
      await screen.findByText("No ranking consolidations yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new consolidation/i })).toBeDisabled();
  });

  it("lists consolidations with their rubric and counts", async () => {
    mockedApi.rankingConsolidations.mockResolvedValue({
      ranking_consolidations: [consolidation()],
    });
    renderPage();

    expect(await screen.findByText("Autumn club ranking")).toBeInTheDocument();
    expect(screen.getByText("Balanced rubric")).toBeInTheDocument();
    expect(screen.getByText("2 sessions")).toBeInTheDocument();
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /autumn club ranking/i })).toHaveAttribute(
      "href",
      "/ranking-consolidations/3",
    );
  });

  it("surfaces a load failure instead of rendering an empty list", async () => {
    mockedApi.rankingConsolidations.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByText("API Error: 500")).toBeInTheDocument();
  });
  it("offers only sessions of the chosen rubric, and marks drafts", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [
        session({ id: 1, name: "Published one" }),
        session({ id: 2, name: "Draft one", status: "draft" }),
        session({
          id: 3,
          name: "Other rubric",
          assessment_definition: {
            id: 9,
            name: "Server rubric",
            status: "active",
            assessment_categories: [],
          },
        }),
      ],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /new consolidation/i }),
    );
    // A draft is offered — it just cannot be published yet — while a session of
    // another rubric is never a valid choice at all.
    expect(await screen.findByText("Published one")).toBeInTheDocument();
    expect(screen.getByText("Draft one")).toBeInTheDocument();
    expect(screen.getByText("Draft — holds publishing back")).toBeInTheDocument();
    expect(screen.queryByText("Other rubric")).not.toBeInTheDocument();
  });

  it("shows each session's date, coach and ranked count so sessions are distinguishable", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [session({ id: 1, name: "September Combine" })],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /new consolidation/i }),
    );

    const picker = await screen.findByRole("group", { name: /^sessions$/i });
    // Name on the first line, then the facts that tell two similarly named
    // sessions apart.
    expect(picker).toHaveTextContent("September Combine");
    expect(picker).toHaveTextContent("Coach Ana");
    // jsdom renders the formatted date in the runtime's locale, so match the
    // year rather than pinning a locale-specific string.
    expect(picker).toHaveTextContent(/2026/);
  });

  it("reports how many sessions are selected and offers select-all / clear", async () => {
    const user = userEvent.setup();
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [
        session({ id: 1, name: "First screening" }),
        session({ id: 2, name: "Second screening" }),
      ],
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /new consolidation/i }));
    expect(await screen.findByText("0 of 2 selected")).toBeInTheDocument();
    // Nothing chosen yet, so clearing is a no-op and stays disabled.
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /select all/i }));
    expect(await screen.findByText("2 of 2 selected")).toBeInTheDocument();
    // Already everything, so select-all is now the no-op.
    expect(screen.getByRole("button", { name: /select all/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(await screen.findByText("0 of 2 selected")).toBeInTheDocument();
  });

  it("marks a chosen session on the row, not only on the checkbox", async () => {
    const user = userEvent.setup();
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [session({ id: 1, name: "First screening" })],
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /new consolidation/i }));
    const picker = await screen.findByRole("group", { name: /^sessions$/i });

    const row = picker.querySelector(".consolidation-session-option") as HTMLElement;
    expect(row).not.toHaveClass("selected");

    await user.click(within(picker).getByText("First screening"));

    expect(
      picker.querySelector(".consolidation-session-option.selected"),
    ).not.toBeNull();
  });

  it("refuses to submit without a name or a session", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [session()],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /new consolidation/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /create consolidation/i }));
    expect(await screen.findByText("Consolidation name is required.")).toBeInTheDocument();
    expect(mockedApi.createRankingConsolidation).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Name"), "Autumn club ranking");
    await userEvent.click(screen.getByRole("button", { name: /create consolidation/i }));
    expect(
      await screen.findByText("Select at least one published session to consolidate."),
    ).toBeInTheDocument();
    expect(mockedApi.createRankingConsolidation).not.toHaveBeenCalled();
  });

  it("submits the sessions the curator ticked", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [
        session({ id: 1, name: "First screening" }),
        session({ id: 2, name: "Second screening" }),
      ],
    });
    mockedApi.createRankingConsolidation.mockResolvedValue({
      ranking_consolidation: consolidation(),
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /new consolidation/i }),
    );
    await userEvent.type(screen.getByLabelText("Name"), "Autumn club ranking");
    await userEvent.click(await screen.findByLabelText(/first screening/i));
    await userEvent.click(screen.getByLabelText(/second screening/i));
    await userEvent.click(screen.getByRole("button", { name: /create consolidation/i }));

    await waitFor(() => expect(mockedApi.createRankingConsolidation).toHaveBeenCalled());
    expect(mockedApi.createRankingConsolidation).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Autumn club ranking",
        assessment_definition_id: 5,
        assessment_session_ids: [1, 2],
      }),
    );
  });

  it("reports a rejected merge without losing what was selected", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [session({ id: 1, name: "First screening" })],
    });
    mockedApi.createRankingConsolidation.mockRejectedValue(
      new Error("Session \"First screening\" uses a different assessment definition"),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /new consolidation/i }),
    );
    await userEvent.type(screen.getByLabelText("Name"), "Autumn club ranking");
    await userEvent.click(await screen.findByLabelText(/first screening/i));
    await userEvent.click(screen.getByRole("button", { name: /create consolidation/i }));

    expect(
      await screen.findByText(/uses a different assessment definition/),
    ).toBeInTheDocument();
    // The dialog stays open with the selection intact so it can be corrected.
    expect(screen.getByLabelText(/first screening/i)).toBeChecked();
  });
});
