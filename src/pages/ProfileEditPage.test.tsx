import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { ApiValidationError, api, type Coach, type Player } from "../api";
import ProfileEditPage from "./ProfileEditPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { me: vi.fn(), player: vi.fn(), coach: vi.fn(), updatePlayer: vi.fn(), updateCoach: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const coachUser = { id: 2, name: "Coach", email_address: "coach@x.com", roles: ["coach"] };
const player = (overrides: Partial<Player> = {}): Player => ({
  id: 12, person_id: 120, display_name: "Pedro Santos", email: "pedro@example.com", preferred_position: "setter", level: "beginner", status: "active", visibility: "shared",
  created_by: { id: 2, name: "Coach" }, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z",
  full_name: "Pedro Santos", account_status: "profile_only", person: null, ...overrides,
});
const coach = (overrides: Partial<Coach> = {}): Coach => ({
  id: 7, person_id: 70, display_name: "Ana Coach", email: "ana@example.com", coaching_level: null, qualifications: null, status: "active", visibility: "shared",
  created_by: { id: 2, name: "Coach" }, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z",
  full_name: "Ana Coach", account_status: "profile_only", person: null, ...overrides,
});

const renderEdit = (path = "/players/12/edit") => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider><Routes>
      <Route path="/players/:id/edit" element={<ProfileEditPage kind="player" />} />
      <Route path="/coaches/:id/edit" element={<ProfileEditPage kind="coach" />} />
      <Route path="/players/:id" element={<div>Player page</div>} />
      <Route path="/coaches/:id" element={<div>Coach page</div>} />
    </Routes></AuthProvider>
  </MemoryRouter>,
);

beforeEach(() => { vi.clearAllMocks(); mockedApi.me.mockResolvedValue(coachUser); mockedApi.player.mockResolvedValue(player()); });
afterEach(() => vi.clearAllMocks());

describe("Profile edit page", () => {
  it("prefills profile fields without exposing Person contact fields", async () => {
    renderEdit();
    expect(await screen.findByLabelText("Display name")).toHaveValue("Pedro Santos");
    expect(screen.getByLabelText("Email")).toHaveValue("pedro@example.com");
    expect(screen.getByLabelText("Preferred position")).toHaveValue("setter");
    expect(screen.getByLabelText("Level")).toHaveValue("beginner");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Contact email")).not.toBeInTheDocument();
  });

  it("PATCHes profile attributes only", async () => {
    mockedApi.updatePlayer.mockResolvedValue({ ...player({ level: "advanced" }), possible_duplicates: [] });
    renderEdit();
    await screen.findByLabelText("Level");
    await userEvent.clear(screen.getByLabelText("Level"));
    await userEvent.type(screen.getByLabelText("Level"), "advanced");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(12, {
      player_profile: { display_name: "Pedro Santos", email: "pedro@example.com", preferred_position: "setter", level: "advanced", visibility: "shared" },
    });
    expect(await screen.findByText("Pedro Santos saved.")).toBeInTheDocument();
  });

  it("shows API validation errors", async () => {
    mockedApi.updatePlayer.mockRejectedValue(new ApiValidationError(["Display name can't be blank"]));
    renderEdit();
    await screen.findByLabelText("Display name");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Display name can't be blank")).toBeInTheDocument();
  });

  it("requires a profile display name before submitting", async () => {
    renderEdit();
    await screen.findByLabelText("Display name");
    await userEvent.clear(screen.getByLabelText("Display name"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("A display name is required.")).toBeInTheDocument();
    expect(mockedApi.updatePlayer).not.toHaveBeenCalled();
  });

  it("locks visibility when someone else recorded the profile", async () => {
    mockedApi.player.mockResolvedValue(player({ created_by: { id: 99, name: "Someone else" } }));
    renderEdit();
    await screen.findByLabelText("Visibility");
    expect(screen.getByLabelText("Visibility")).toBeDisabled();
  });

  it("updates a coach profile without sending Person fields", async () => {
    mockedApi.coach.mockResolvedValue(coach());
    mockedApi.updateCoach.mockResolvedValue({ ...coach({ visibility: "private" }), possible_duplicates: [] });
    renderEdit("/coaches/7/edit");
    await screen.findByLabelText("Visibility");
    await userEvent.selectOptions(screen.getByLabelText("Visibility"), "private");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mockedApi.updateCoach).toHaveBeenCalledWith(7, {
      coach_profile: { display_name: "Ana Coach", email: "ana@example.com", coaching_level: null, qualifications: null, visibility: "private" },
    });
  });
});
