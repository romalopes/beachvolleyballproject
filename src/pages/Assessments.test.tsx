import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Assessment } from "../api";
import { paginated } from "../test/paginated";
import Assessments from "./Assessments";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { ...actual.api, me: vi.fn(), assessments: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const coachUser = { id: 2, name: "Coach", email_address: "coach@x.com", roles: ["coach"] };

const row = (overrides: Partial<Assessment> = {}): Assessment => ({
  id: 1,
  player_profile_id: 12,
  coach_profile_id: 7,
  skill_id: 5,
  custom_skill: null,
  training_session_id: null,
  score: 70,
  reported_value: 4,
  scale: "one_to_five",
  notes: "Consistent platform",
  status: "active",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  skill_label: "Forearm pass",
  ten_scale: 7,
  five_scale: 4,
  score_label: "70/100",
  status_label: "Published",
  created_by: { id: 2, name: "Coach Ana" },
  skill: { id: 5, title: "Forearm pass", slug: "forearm-pass", description: null, category_id: 1 },
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Assessments />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.assessments.mockResolvedValue(paginated([]));
});

afterEach(() => vi.clearAllMocks());

describe("Assessments", () => {
  it("lists the rows the viewer may see, with links and scores", async () => {
    mockedApi.assessments.mockResolvedValue(paginated([row()]));
    renderPage();

    expect(await screen.findByText("Player #12")).toBeInTheDocument();
    expect(screen.getByText("Forearm pass")).toBeInTheDocument();
    expect(screen.getByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
    const statusTag = screen.getByTitle("70/100").closest("li");
    expect(statusTag).toHaveTextContent("Published");
    expect(screen.getByText("Coach Ana")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Player #12" });
    expect(link).toHaveAttribute("href", "/players/12");
  });

  it("requests active rows by default and applies the status filter", async () => {
    renderPage();
    await screen.findByText("No assessments found");
    expect(mockedApi.assessments).toHaveBeenCalledWith({ page: 1, per_page: 20 });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filter assessments by status" }),
      "draft",
    );
    expect(mockedApi.assessments).toHaveBeenLastCalledWith({
      status: "draft",
      page: 1,
      per_page: 20,
    });
  });

  it("narrow to rows I recorded", async () => {
    renderPage();
    await screen.findByText("No assessments found");

    await userEvent.click(screen.getByRole("checkbox"));
    expect(mockedApi.assessments).toHaveBeenLastCalledWith({
      mine: true,
      page: 1,
      per_page: 20,
    });
  });

  it("reports a failed load", async () => {
    mockedApi.assessments.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByText("API Error: 500")).toBeInTheDocument();
  });
});
