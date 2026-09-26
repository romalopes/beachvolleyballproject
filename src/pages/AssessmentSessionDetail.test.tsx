import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AssessmentSession } from "../api";
import AssessmentSessionDetail from "./AssessmentSessionDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      assessmentSession: vi.fn(),
      publishAssessmentSession: vi.fn(),
      addAssessmentSessionPlayers: vi.fn(),
      removeAssessmentSessionPlayers: vi.fn(),
      saveAssessmentSessionScores: vi.fn(),
      players: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const session = (overrides: Partial<AssessmentSession> = {}): AssessmentSession =>
  ({
    id: 12,
    name: "September Combine",
    status: "draft",
    status_label: "Draft",
    scheduled_on: "2026-09-20",
    created_by_id: 2,
    coach_profile_id: 7,
    coach_profile: { id: 7, full_name: "Coach Ana" },
    assessment_definition: {
      id: 5,
      name: "A-Level Assessment",
      status: "active",
      assessment_categories: [
        { id: 1, label: "Attack", weight: 60, position: 0 },
        { id: 2, label: "Block", weight: 40, position: 1 },
      ],
    },
    ranking: { ranking: [], incomplete: [], excluded: [] },
    participants: [
      {
        id: 1,
        player_profile_id: 1,
        player_name: "Ana Silva",
        inclusion: "included",
        missing_reason: null,
        result: {
          player_profile_id: 1,
          player_name: "Ana Silva",
          overall_score: 80,
          rank: 1,
          missing_category_ids: [],
          status: "complete",
        },
      },
    ],
    ...overrides,
  }) as AssessmentSession;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/assessment-sessions/12"]}>
      <Routes>
        <Route
          path="/assessment-sessions/:id"
          element={<AssessmentSessionDetail />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.assessmentSession.mockResolvedValue({
    assessment_session: session(),
  } as never);
  mockedApi.players.mockResolvedValue({ data: [] } as never);
});

describe("AssessmentSessionDetail", () => {
  it("shows the session's rubric, coach and scheduled date", async () => {
    renderPage();

    expect(await screen.findByText("September Combine")).toBeInTheDocument();
    // Rendered as "Rubric: A-Level Assessment" inside one span, so match the
    // container rather than the bare name.
    const meta = document.querySelector(".session-meta") as HTMLElement;
    expect(meta).toHaveTextContent("A-Level Assessment");
    expect(meta).toHaveTextContent("Coach Ana");
    expect(meta).toHaveTextContent("Draft");
  });

  it("reports a session that cannot be loaded", async () => {
    mockedApi.assessmentSession.mockRejectedValue(new Error("API Error: 404"));
    renderPage();

    expect(await screen.findByText("Assessment session not found")).toBeInTheDocument();
    expect(screen.getByText("API Error: 404")).toBeInTheDocument();
  });

  it("offers Publish for a draft session", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /^publish$/i })).toBeInTheDocument();
  });

  it("withholds Publish once the session is published", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published", status_label: "Published" }),
    } as never);
    renderPage();

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^publish$/i })).not.toBeInTheDocument();
  });

  it("explains why publishing failed and keeps the session editable", async () => {
    const user = userEvent.setup();
    mockedApi.publishAssessmentSession.mockRejectedValue(
      new Error("Score every included player before publishing"),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^publish$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Score every included player before publishing",
    );
    // The coach keeps their draft and the Publish action remains available.
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeInTheDocument();
  });

  it("switches to the ranking view after a successful publish", async () => {
    const user = userEvent.setup();
    // The page loads as a draft; the publish response is what moves it forward.
    mockedApi.publishAssessmentSession.mockResolvedValue({
      assessment_session: session({
        status: "published",
        status_label: "Published",
        ranking: {
          ranking: [
            {
              player_profile_id: 1,
              player_name: "Ana Silva",
              overall_score: 80,
              rank: 1,
              missing_category_ids: [],
              status: "complete",
            },
          ],
          incomplete: [],
          excluded: [],
        },
      }),
    } as never);
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^publish$/i }));

    expect(await screen.findByText("Official Ranking (1)")).toBeInTheDocument();
    // A published session is archival, so the action is gone.
    expect(screen.queryByRole("button", { name: /^publish$/i })).not.toBeInTheDocument();
  });

  it("lets the coach move between roster, scores and ranking", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /scores/i }));
    expect(screen.getByLabelText("Ana Silva Attack")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /ranking/i }));
    expect(screen.getByText(/No players on the session roster yet/i)).toBeInTheDocument();
  });
});
