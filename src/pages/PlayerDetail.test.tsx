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
      playerCoaches: vi.fn(),
      skills: vi.fn().mockResolvedValue([]),
      claimInvitations: vi.fn().mockResolvedValue([]),
      createClaimInvitation: vi.fn(),
      revokeClaimInvitation: vi.fn(),
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
  person_id: 5,
};
const adminUser = {
  id: 3,
  name: "Admin",
  email_address: "admin@x.com",
  roles: ["admin"],
  person_id: 6,
};


/** The only state a claim invitation can exist in: no Person yet. */
const unlinkedPlayer = (overrides: Partial<Player> = {}): Player =>
  player({
    person_id: null,
    display_name: "Pedro Santos",
    person: undefined as never,
    ...overrides,
  });

const invitation = (overrides = {}) => ({
  id: 5,
  claimable_type: "PlayerProfile" as const,
  claimable_id: 12,
  player_profile_id: 12,
  person_id: null,
  invitee_email: null,
  emailed_at: null,
  auto_approvable: false,
  status: "active" as const,
  expires_at: "2026-10-20T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-10-13T00:00:00.000Z",
  ...overrides,
});

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
  mockedApi.playerCoaches.mockResolvedValue([]);
  mockedApi.claimInvitations.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe("PlayerDetail", () => {
  describe("claim invitations", () => {
    it("offers the owner a claim invitation for an unlinked profile and reveals the link", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: 9 });
      mockedApi.player.mockResolvedValue(unlinkedPlayer());
      mockedApi.createClaimInvitation.mockResolvedValue({
        invitation: invitation(),
        token: "one-time-secret",
        email_delivered: false,
      });
      renderDetail();

      await userEvent.click(
        await screen.findByRole("button", { name: "Create claim invitation" }),
      );

      // The panel passes the subject kind and the optional address.
      expect(mockedApi.createClaimInvitation).toHaveBeenCalledWith(
        "PlayerProfile",
        12,
        undefined,
      );
      const field = await screen.findByLabelText("Claim invitation link");
      expect(field).toHaveValue(
        `${window.location.origin}/identity#claim_token=one-time-secret`,
      );
    });

    it("explains why a linked profile needs no invitation instead of showing nothing", async () => {
      renderDetail();
      await screen.findByRole("heading", { name: "Pedro Santos" });

      // The identity block renders the person, and no invitation control appears.
      expect(screen.getByText(/a profile entered by a coach/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Create claim invitation" }),
      ).not.toBeInTheDocument();
    });

    it("tells a coach who did not record the profile why they cannot invite", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: 9 });
      mockedApi.player.mockResolvedValue(
        unlinkedPlayer({ created_by: { id: 99, name: "Other Coach" } }),
      );
      renderDetail();
      await screen.findByRole("heading", { name: "Pedro Santos" });

      expect(
        await screen.findByText(/only an administrator or the coach who recorded/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Create claim invitation" }),
      ).not.toBeInTheDocument();
    });

    it("tells an owner without a linked Person why they cannot invite", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: undefined });
      mockedApi.player.mockResolvedValue(unlinkedPlayer());
      renderDetail();
      await screen.findByRole("heading", { name: "Pedro Santos" });

      expect(
        await screen.findByText(/needs a linked Person before you can issue/i),
      ).toBeInTheDocument();
    });

    it("lets an admin invite even though they did not record the profile", async () => {
      mockedApi.me.mockResolvedValue(adminUser);
      mockedApi.player.mockResolvedValue(
        unlinkedPlayer({ created_by: { id: 2, name: "Coach" } }),
      );
      renderDetail();

      expect(
        await screen.findByRole("button", { name: "Create claim invitation" }),
      ).toBeInTheDocument();
    });

    it("restores invitation state on reload instead of losing it with the token", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: 9 });
      mockedApi.player.mockResolvedValue(unlinkedPlayer());
      mockedApi.claimInvitations.mockResolvedValue([invitation()]);
      renderDetail();
      await screen.findByRole("heading", { name: "Pedro Santos" });

      // This is the regression that made the feature unusable: the raw token is
      // shown once, so the list is the only durable answer to "is one live?".
      expect(await screen.findByText(/expires/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    });

    it("revokes an active invitation through the API", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: 9 });
      mockedApi.player.mockResolvedValue(unlinkedPlayer());
      mockedApi.claimInvitations.mockResolvedValue([invitation()]);
      mockedApi.revokeClaimInvitation.mockResolvedValue(
        invitation({ status: "revoked" }),
      );
      renderDetail();
      await screen.findByRole("heading", { name: "Pedro Santos" });

      await userEvent.click(await screen.findByRole("button", { name: "Revoke" }));

      expect(mockedApi.revokeClaimInvitation).toHaveBeenCalledWith(5);
    });

    it("surfaces a failed invitation instead of failing silently", async () => {
      mockedApi.me.mockResolvedValue({ ...coachUser, person_id: 9 });
      mockedApi.player.mockResolvedValue(unlinkedPlayer());
      mockedApi.createClaimInvitation.mockRejectedValue(
        new Error("A linked Person is required to create an invitation"),
      );
      renderDetail();

      await userEvent.click(
        await screen.findByRole("button", { name: "Create claim invitation" }),
      );

      expect(
        await screen.findByRole("alert"),
      ).toHaveTextContent(/linked Person is required/i);
    });
  });
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

  it("has no assessment-creation controls on the player page", async () => {
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

    const heading = await screen.findByRole("heading", { name: "Assessments" });
    const section = heading.closest("section") as HTMLElement;

    // The read-only history is present…
    expect(within(section).getByText("Attack")).toBeInTheDocument();

    // …but every legacy creation/edit control is gone (assessment plan §8).
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Scale" })).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

});
