import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Coach } from "../api";
import CoachDetail from "./CoachDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      coach: vi.fn(),
      updateCoach: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const coachUser = {
  id: 2,
  name: "Coach",
  email_address: "coach@x.com",
  roles: ["coach"],
};
const playerUser = {
  id: 1,
  name: "Player",
  email_address: "player@x.com",
  roles: ["player"],
};

const coach = (overrides: Partial<Coach> = {}): Coach => ({
  id: 7,
  person_id: 70,
  coaching_level: "club",
  qualifications: "Level 1",
  status: "active",
  visibility: "shared",
  created_by: { id: 2, name: "Coach" },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  full_name: "Olga Reyes",
  account_status: "profile_only",
  coach_profile_id: 7,
  person: {
    id: 70,
    first_name: "Olga",
    last_name: "Reyes",
    email: "olga@example.com",
    phone: "+61400000007",
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/coaches/7"]}>
      <AuthProvider>
        <Routes>
          <Route path="/coaches/:id" element={<CoachDetail />} />
          <Route path="/coaches/:id/edit" element={<div>Edit coach page</div>} />
          <Route path="/coaches" element={<div>Coaches page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.coach.mockResolvedValue(coach());
});

afterEach(() => vi.clearAllMocks());

describe("CoachDetail", () => {
  it("shows the identity, coaching details and profile state", async () => {
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Olga Reyes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Profile only")).toBeInTheDocument();
    expect(screen.getByText("club")).toBeInTheDocument();
    expect(screen.getByText(/a profile entered by a coach/)).toBeInTheDocument();
    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    expect(screen.getByText("Visibility: Shared")).toBeInTheDocument();
  });

  it("loads the coach by id", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Olga Reyes" });
    expect(mockedApi.coach).toHaveBeenCalledWith(7);
  });

  it("offers Edit to a coach", async () => {
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
  });

  it("hides Edit from a player", async () => {
    mockedApi.me.mockResolvedValue(playerUser);
    renderDetail();
    await screen.findByRole("heading", { name: "Olga Reyes" });

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("reports a missing coach", async () => {
    mockedApi.coach.mockRejectedValue(new Error("API Error: 404"));
    renderDetail();

    expect(await screen.findByText("Coach not found")).toBeInTheDocument();
  });

  it("archives a coach after confirming", async () => {
    mockedApi.updateCoach.mockResolvedValue({
      ...coach({ status: "archived" }),
      possible_duplicates: [],
    });
    renderDetail();
    await screen.findByRole("heading", { name: "Olga Reyes" });

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Archive" }),
    );

    expect(mockedApi.updateCoach).toHaveBeenCalledWith(7, {
      coach_profile: { status: "archived" },
    });
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("restores an archived coach", async () => {
    mockedApi.coach.mockResolvedValue(coach({ status: "archived" }));
    mockedApi.updateCoach.mockResolvedValue({
      ...coach({ status: "active" }),
      possible_duplicates: [],
    });
    renderDetail();
    await screen.findByText("Archived");

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mockedApi.updateCoach).toHaveBeenCalledWith(7, {
      coach_profile: { status: "active" },
    });
    expect(
      await screen.findByRole("button", { name: "Archive" }),
    ).toBeInTheDocument();
  });

  it("marks a private coach with a Private tag", async () => {
    mockedApi.coach.mockResolvedValue(coach({ visibility: "private" }));
    renderDetail();

    await screen.findByRole("heading", { name: "Olga Reyes" });
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Visibility: Private")).toBeInTheDocument();
  });

  it("shows no Private tag for a shared coach", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Olga Reyes" });
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });

  it("shows the assessments attributed to this coach", async () => {
    mockedApi.coach.mockResolvedValue(coach({
      assessments_recorded_count: 1,
      recent_assessments: [{
        id: 1, player_profile_id: 12, coach_profile_id: 7, category_id: 5, custom_category: null,
        training_session_id: null, score: 70, reported_value: 4, scale: "one_to_five",
        notes: null, status: "active", created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z", category_label: "Attack", ten_scale: 7,
        five_scale: 4, score_label: "70/100", status_label: "Published",
        created_by: { id: 2, name: "Coach Ana" },
        category: { id: 5, name: "Attack", slug: "attack" },
      }],
    }));
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Recorded assessments" })).toBeInTheDocument();
    expect(screen.getByText(/1 published assessment attributed to this coach/)).toBeInTheDocument();
    expect(screen.getByText("Attack")).toBeInTheDocument();
    expect(screen.getByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
  });
});
