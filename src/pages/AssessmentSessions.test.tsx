import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AssessmentSession } from "../api";
import AssessmentSessions from "./AssessmentSessions";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      assessmentSessions: vi.fn(),
      assessmentDefinitions: vi.fn(),
      coaches: vi.fn(),
      createAssessmentSession: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const definition = {
  id: 5,
  name: "A-Level Assessment",
  status: "active" as const,
  assessment_categories: [
    { id: 1, label: "Attack", weight: 40, position: 0, source_type: "category" },
    { id: 2, label: "Block", weight: 30, position: 1, source_type: "category" },
  ],
};

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
      assessment_categories: [],
    },
    ranking: { ranking: [], incomplete: [], excluded: [] },
    participants: [
      {
        id: 1,
        player_profile_id: 1,
        player_name: "Ana Silva",
        inclusion: "included",
        missing_reason: null,
      },
      {
        id: 2,
        player_profile_id: 2,
        player_name: "Bruno Alves",
        inclusion: "included",
        missing_reason: null,
      },
    ],
    ...overrides,
  }) as AssessmentSession;

const renderPage = () =>
  render(
    <MemoryRouter>
      <AssessmentSessions />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.assessmentSessions.mockResolvedValue({
    assessment_sessions: [session()],
  } as never);
  mockedApi.assessmentDefinitions.mockResolvedValue({
    data: [definition],
  } as never);
  mockedApi.coaches.mockResolvedValue({
    data: [
      { id: 7, full_name: "Coach Ana", status: "active" },
      { id: 8, full_name: "Coach Will", status: "active" },
    ],
  } as never);
});


describe("AssessmentSessions list", () => {
  it("lists sessions with rubric, coach, roster count and status", async () => {
    renderPage();

    expect(await screen.findByText("September Combine")).toBeInTheDocument();
    expect(screen.getByText("A-Level Assessment")).toBeInTheDocument();
    expect(screen.getByText("Coach Ana")).toBeInTheDocument();
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("explains an empty list", async () => {
    mockedApi.assessmentSessions.mockResolvedValue({
      assessment_sessions: [],
    } as never);
    renderPage();

    expect(
      await screen.findByText("No assessment sessions yet"),
    ).toBeInTheDocument();
  });

  it("surfaces a load failure", async () => {
    mockedApi.assessmentSessions.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("API Error: 500");
  });
});

describe("AssessmentSessions wizard", () => {
  const openWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: /new session/i }));
    return screen.findByRole("heading", { name: /new assessment session/i });
  };

  it("previews the chosen rubric's categories and weights", async () => {
    const user = userEvent.setup();
    renderPage();
    await openWizard(user);

    // Scoped to the preview: the same rubric name also appears in the list row.
    const preview = (await document.querySelector(".wizard-rubric-preview")) as HTMLElement;
    expect(preview).toHaveTextContent("A-Level Assessment");
    expect(preview).toHaveTextContent("Attack");
    expect(preview).toHaveTextContent("40%");
    expect(preview).toHaveTextContent("Block");
    expect(preview).toHaveTextContent("30%");
  });

  it("requires a name before it will create the session", async () => {
    const user = userEvent.setup();
    renderPage();
    await openWizard(user);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session name is required.",
    );
    expect(mockedApi.createAssessmentSession).not.toHaveBeenCalled();
  });

  it("creates a session with rubric, coach and a date", async () => {
    const user = userEvent.setup();
    mockedApi.createAssessmentSession.mockResolvedValue({
      assessment_session: session({ id: 99 }),
    } as never);
    renderPage();
    await openWizard(user);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByLabelText(/Session name/i), "Autumn Combine");
    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(mockedApi.createAssessmentSession).toHaveBeenCalled());
    const payload = mockedApi.createAssessmentSession.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Autumn Combine",
      assessment_definition_id: 5,
      coach_profile_id: 7,
    });
    expect(payload.scheduled_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("surfaces a server refusal and keeps the coach's input", async () => {
    const user = userEvent.setup();
    mockedApi.createAssessmentSession.mockRejectedValue(
      new Error("Select an active assessment definition first."),
    );
    renderPage();
    await openWizard(user);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.type(screen.getByLabelText(/Session name/i), "Autumn Combine");
    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select an active assessment definition first.",
    );
    expect(screen.getByLabelText(/Session name/i)).toHaveValue("Autumn Combine");
  });
});
