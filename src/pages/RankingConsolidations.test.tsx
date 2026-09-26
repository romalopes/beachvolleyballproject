import { render, screen, waitFor } from "@testing-library/react";
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
  assessment_definition: { id: 5, name: "Balanced rubric" },
  session_count: 2,
  player_count: 2,
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
  it("offers only published sessions of the chosen rubric", async () => {
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
    // The draft and the foreign rubric are never offered as choices.
    expect(await screen.findByText("Published one")).toBeInTheDocument();
    expect(screen.queryByText("Draft one")).not.toBeInTheDocument();
    expect(screen.queryByText("Other rubric")).not.toBeInTheDocument();
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
