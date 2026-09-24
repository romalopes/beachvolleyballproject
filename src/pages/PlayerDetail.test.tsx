import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Player, type TrainingSessionParticipant } from "../api";
import PlayerDetail from "./PlayerDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      player: vi.fn(),
      updatePlayer: vi.fn(),
      coaches: vi.fn(),
      skills: vi.fn().mockResolvedValue([]),
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

const participant: TrainingSessionParticipant = {
  id: 5,
  player_profile_id: 12,
  status: "attended",
  notes: null,
};

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 12,
  person_id: 120,
  preferred_position: "setter",
  level: "beginner",
  status: "active",
  visibility: "shared",
  created_by: { id: 2, name: "Coach" },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  full_name: "Pedro Santos",
  account_status: "profile_only",
  training_session_count: 1,
  person: {
    id: 120,
    first_name: "Pedro",
    last_name: "Santos",
    email: "pedro@example.com",
    phone: "+61400000001",
    date_of_birth: "1995-04-12",
    creation_source: "coach_created",
  },
  training_session_participants: [
    {
      ...participant,
      created_at: "2026-09-02T00:00:00.000Z",
      training_session: {
        id: 7,
        title: "Serve Reception Training",
        starts_at: "2026-09-21T09:00:00.000Z",
        ends_at: "2026-09-21T11:00:00.000Z",
        location: "Coogee Beach",
        status: "scheduled",
        visibility: "shared",
      },
    },
  ],
  ...overrides,
});

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/players/12"]}>
      <AuthProvider>
        <Routes>
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/players/:id/edit" element={<div>Edit player page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.player.mockResolvedValue(player());
  mockedApi.coaches.mockResolvedValue({ data: [], meta: { page: 1, per_page: 100, total: 0, total_pages: 1 } });
});

afterEach(() => vi.clearAllMocks());

describe("PlayerDetail", () => {
  it("shows the identity, its provenance and the training history", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Pedro Santos" })).toBeInTheDocument();
    expect(screen.getByText("Profile only")).toBeInTheDocument();
    expect(screen.getByText(/a profile entered by a coach/)).toBeInTheDocument();
    expect(screen.getByText("Serve Reception Training")).toBeInTheDocument();
    expect(screen.getByText("Attended")).toBeInTheDocument();
  });

  it("offers Edit to a coach", async () => {
    renderDetail();

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides Edit from a player", async () => {
    mockedApi.me.mockResolvedValue(playerUser);
    renderDetail();
    await screen.findByRole("heading", { name: "Pedro Santos" });

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("reports a missing player", async () => {
    mockedApi.player.mockRejectedValue(new Error("API Error: 404"));
    renderDetail();

    expect(await screen.findByText("Player not found")).toBeInTheDocument();
  });

  it("archives a player after confirming and keeps the history visible", async () => {
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ status: "archived" }),
      possible_duplicates: [],
    });
    renderDetail();
    await screen.findByRole("heading", { name: "Pedro Santos" });

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/training history is kept/);

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Archive" }),
    );

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(12, {
      player_profile: { status: "archived" },
    });
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    // Archiving never removes history.
    expect(screen.getByText("Serve Reception Training")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("restores an archived player", async () => {
    mockedApi.player.mockResolvedValue(player({ status: "archived" }));
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ status: "active" }),
      possible_duplicates: [],
    });
    renderDetail();
    await screen.findByText("Archived");

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(12, {
      player_profile: { status: "active" },
    });
    expect(
      await screen.findByRole("button", { name: "Archive" }),
    ).toBeInTheDocument();
  });

  it("marks a private player with a Private tag", async () => {
    mockedApi.player.mockResolvedValue(player({ visibility: "private" }));
    renderDetail();

    await screen.findByRole("heading", { name: "Pedro Santos" });
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("shows no Private tag for a shared player", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Pedro Santos" });
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });

  it("shows the player's assessment history with scores", async () => {
    mockedApi.player.mockResolvedValue(player({
      assessment_count: 1,
      assessments: [{
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

    expect(await screen.findByRole("heading", { name: "Assessments" })).toBeInTheDocument();
    expect(screen.getByText("Attack")).toBeInTheDocument();
    expect(screen.getByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
  });
});
