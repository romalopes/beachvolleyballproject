import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AssessmentSession } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import AssessmentSessionDetail from "./AssessmentSessionDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      assessmentSession: vi.fn(),
      publishAssessmentSession: vi.fn(),
      deleteAssessmentSession: vi.fn(),
      withdrawAssessmentSession: vi.fn(),
      restoreAssessmentSession: vi.fn(),
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

// The page reads the signed-in user to decide whether the admin-only controls are
// offered, so tests supply one directly rather than standing up a full provider.
// `null` is the default: a non-admin, which is what most of these tests are.
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
      <MemoryRouter initialEntries={["/assessment-sessions/12"]}>
        <Routes>
          <Route
            path="/assessment-sessions/:id"
            element={<AssessmentSessionDetail />}
          />
          {/* So a successful delete has somewhere to land; without it the
              navigation logs a "no routes matched" warning. */}
          <Route path="/assessment-sessions" element={<div>All sessions</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.assessmentSession.mockResolvedValue({
    assessment_session: session(),
  } as never);
  mockedApi.players.mockResolvedValue({ data: [] } as never);
});

describe("withdrawal and restore", () => {
  it("offers Withdraw on a published session", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published" }),
    });
    renderPage();

    // Anchored on the button itself: the default fixture has no players, so there
    // is no ranking table to wait for.
    expect(await screen.findByRole("button", { name: /^withdraw$/i })).toBeInTheDocument();
  });

  it("withdraws a published session and shows it as withdrawn", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published", status_label: "Published" }),
    });
    mockedApi.withdrawAssessmentSession.mockResolvedValue({
      assessment_session: session({
        status: "withdrawn",
        status_label: "Withdrawn",
        published_at: null,
      }),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /^withdraw$/i }));

    expect(mockedApi.withdrawAssessmentSession).toHaveBeenCalledWith(12);
    await screen.findByText("Withdrawn");
    confirmSpy.mockRestore();
  });

  it("keeps the session when the withdrawal is cancelled", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published" }),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /^withdraw$/i }));

    expect(mockedApi.withdrawAssessmentSession).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // The admin-only rule is a real boundary, so the UI must not offer the
  // irreversible control to a non-admin: the server would refuse, but offering it
  // would teach coaches to expect something that cannot happen.
  it("offers no permanent delete on a published session to a non-admin", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published" }),
    });
    renderPage(authValue());

    expect(await screen.findByRole("button", { name: /^withdraw$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete permanently/i }),
    ).not.toBeInTheDocument();
  });

  it("offers an admin restore and permanent delete on a withdrawn session", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({
        status: "withdrawn",
        status_label: "Withdrawn",
        published_at: null,
      }),
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

  it("restores a withdrawn session to draft for an admin", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({
        status: "withdrawn",
        status_label: "Withdrawn",
        published_at: null,
      }),
    });
    mockedApi.restoreAssessmentSession.mockResolvedValue({
      assessment_session: session({ status: "draft", status_label: "Draft" }),
    });
    renderPage(authValue({ user: adminUser }));

    await userEvent.click(
      await screen.findByRole("button", { name: /restore to draft/i }),
    );

    expect(mockedApi.restoreAssessmentSession).toHaveBeenCalledWith(12, "draft");
    await screen.findByRole("button", { name: /^publish$/i });
  });

  it("surfaces a refusal and keeps the session withdrawn", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({
        status: "withdrawn",
        status_label: "Withdrawn",
        published_at: null,
      }),
    });
    mockedApi.restoreAssessmentSession.mockRejectedValue(
      new Error("Only a draft session can be published"),
    );
    renderPage(authValue({ user: adminUser }));

    await userEvent.click(
      await screen.findByRole("button", { name: /restore to published/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Only a draft session can be published");
    // Still withdrawn: a refused restore must not look like a successful one.
    expect(
      screen.getByRole("button", { name: /restore to published/i }),
    ).toBeInTheDocument();
  });
});

describe("draft deletion", () => {
  it("offers deleting a draft and returns to the list on success", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.deleteAssessmentSession.mockResolvedValue({
      message: "Draft session deleted",
      id: 12,
    } as never);
    renderPage();

    await user.click(await screen.findByRole("button", { name: /delete draft/i }));

    expect(mockedApi.deleteAssessmentSession).toHaveBeenCalledWith(12);
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("keeps the session when the coach cancels the confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();

    await user.click(await screen.findByRole("button", { name: /delete draft/i }));

    expect(mockedApi.deleteAssessmentSession).not.toHaveBeenCalled();
  });

  it("surfaces a server refusal instead of navigating away", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApi.deleteAssessmentSession.mockRejectedValue(
      new Error("Only draft sessions can be modified"),
    );
    renderPage();

    await user.click(await screen.findByRole("button", { name: /delete draft/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only draft sessions can be modified",
    );
  });

  // A published session is archival, so the control is not merely refused — it
  // is absent, so nobody is offered a delete that cannot work.
  it("offers no delete control on a published session", async () => {
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ status: "published", status_label: "Published" }),
    } as never);
    renderPage();

    await screen.findByText("September Combine");

    expect(
      screen.queryByRole("button", { name: /delete draft/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^publish$/i }),
    ).not.toBeInTheDocument();
  });
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

    // Anchored, because "Ranking Consolidated" also matches a loose /ranking/i.
    await user.click(screen.getByRole("tab", { name: /^ranking$/i }));
    expect(screen.getByText(/No players on the session roster yet/i)).toBeInTheDocument();
  });

  it("opens the Ranking Consolidated tab and lists the rankings this session feeds", async () => {
    const user = userEvent.setup();
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({
        consolidations: [
          {
            id: 5,
            name: "Autumn club ranking",
            status: "published",
            status_label: "Published",
            published_at: "2026-09-27T09:46:00Z",
            included_in_ranking: true,
          },
        ],
      }),
    });
    renderPage();

    await user.click(
      await screen.findByRole("tab", { name: /ranking consolidated/i }),
    );

    const link = await screen.findByRole("link", { name: /Autumn club ranking/i });
    expect(link).toHaveAttribute("href", "/ranking-consolidations/5");
    expect(screen.getByText("Published")).toBeInTheDocument();
    // Contributed, so no caveat is shown.
    expect(
      screen.queryByText(/not included in this ranking/i),
    ).not.toBeInTheDocument();
  });

  it("flags a ranking this session is attached to but not counted in", async () => {
    // The consequence a coach needs before retracting: this session is still listed
    // as a source, but its scores are not in that ranking's numbers.
    const user = userEvent.setup();
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({
        consolidations: [
          {
            id: 5,
            name: "Autumn club ranking",
            status: "published",
            status_label: "Published",
            published_at: "2026-09-27T09:46:00Z",
            included_in_ranking: false,
          },
        ],
      }),
    });
    renderPage();

    await user.click(
      await screen.findByRole("tab", { name: /ranking consolidated/i }),
    );

    expect(
      await screen.findByText(/not included in this ranking/i),
    ).toBeInTheDocument();
  });

  it("explains an empty list rather than showing a blank tab", async () => {
    const user = userEvent.setup();
    mockedApi.assessmentSession.mockResolvedValue({
      assessment_session: session({ consolidations: [] }),
    });
    renderPage();

    await user.click(
      await screen.findByRole("tab", { name: /ranking consolidated/i }),
    );

    expect(
      await screen.findByText(/not been merged into any ranking/i),
    ).toBeInTheDocument();
  });
});
