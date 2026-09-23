import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ApiValidationError, api, type Coach, type Player } from "../api";
import PersonProfileEditPage from "./PersonProfileEditPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      player: vi.fn(),
      coach: vi.fn(),
      updatePlayer: vi.fn(),
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
  person: {
    id: 120,
    first_name: "Pedro",
    last_name: "Santos",
    email: "pedro@example.com",
    phone: "+61400000001",
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const coachRecord = (overrides: Partial<Coach> = {}): Coach => ({
  id: 7,
  person_id: 70,
  coaching_level: null,
  qualifications: null,
  status: "active",
  visibility: "shared",
  created_by: { id: 2, name: "Coach" },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  full_name: "Ana Coach",
  account_status: "profile_only",
  person: {
    id: 70,
    first_name: "Ana",
    last_name: "Coach",
    email: "ana@example.com",
    phone: null,
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const renderEdit = (path = "/players/12/edit") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/players/:id/edit"
            element={<PersonProfileEditPage kind="player" />}
          />
          <Route
            path="/coaches/:id/edit"
            element={<PersonProfileEditPage kind="coach" />}
          />
          <Route path="/players/:id" element={<div>Player page</div>} />
          <Route path="/coaches" element={<div>Coaches page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.player.mockResolvedValue(player());
});

afterEach(() => vi.clearAllMocks());

describe("PersonProfileEditPage", () => {
  it("prefills the person and profile fields", async () => {
    renderEdit();

    expect(await screen.findByLabelText("First name")).toHaveValue("Pedro");
    expect(screen.getByLabelText("Last name")).toHaveValue("Santos");
    expect(screen.getByLabelText("Contact email")).toHaveValue(
      "pedro@example.com",
    );
    expect(screen.getByLabelText("Phone")).toHaveValue("+61400000001");
    expect(screen.getByLabelText("Preferred position")).toHaveValue("setter");
    expect(screen.getByLabelText("Level")).toHaveValue("beginner");
    expect(screen.getByLabelText("Visibility")).toHaveValue("shared");
    expect(mockedApi.player).toHaveBeenCalledWith(12);
  });

  it("PATCHes the changed values", async () => {
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ level: "advanced" }),
      possible_duplicates: [],
    });
    renderEdit();
    await screen.findByLabelText("Level");

    await userEvent.clear(screen.getByLabelText("Level"));
    await userEvent.type(screen.getByLabelText("Level"), "advanced");
    await userEvent.clear(screen.getByLabelText("Last name"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(12, {
      person: {
        first_name: "Pedro",
        last_name: null,
        email: "pedro@example.com",
        phone: "+61400000001",
      },
      player_profile: {
        preferred_position: "setter",
        level: "advanced",
        visibility: "shared",
      },
    });
    expect(await screen.findByText("Pedro Santos saved.")).toBeInTheDocument();
  });

  it("warns about possible duplicates after a rename", async () => {
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ full_name: "Maria Silva" }),
      possible_duplicates: [
        {
          id: 99,
          first_name: "Maria",
          last_name: "Silva",
          full_name: "Maria Silva",
          email: "maria@example.com",
          phone: null,
          date_of_birth: null,
          creation_source: "signup",
          account_status: "connected",
          player_profile_id: 44,
          coach_profile_id: null,
        },
      ],
    });
    renderEdit();
    await screen.findByLabelText("First name");

    await userEvent.clear(screen.getByLabelText("First name"));
    await userEvent.type(screen.getByLabelText("First name"), "Maria");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Possible duplicates")).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing was merged automatically/),
    ).toBeInTheDocument();
  });

  it("shows API validation errors", async () => {
    mockedApi.updatePlayer.mockRejectedValue(
      new ApiValidationError(["Person first name can't be blank"]),
    );
    renderEdit();
    await screen.findByLabelText("First name");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Person first name can't be blank"),
    ).toBeInTheDocument();
  });

  it("requires a first name before submitting", async () => {
    renderEdit();
    await screen.findByLabelText("First name");

    await userEvent.clear(screen.getByLabelText("First name"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("A first name is required.")).toBeInTheDocument();
    expect(mockedApi.updatePlayer).not.toHaveBeenCalled();
  });

  it("flips visibility to private when the owner saves", async () => {
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ visibility: "private" }),
      possible_duplicates: [],
    });
    renderEdit();
    await screen.findByLabelText("Visibility");

    await userEvent.selectOptions(screen.getByLabelText("Visibility"), "private");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(12, {
      person: {
        first_name: "Pedro",
        last_name: "Santos",
        email: "pedro@example.com",
        phone: "+61400000001",
      },
      player_profile: {
        preferred_position: "setter",
        level: "beginner",
        visibility: "private",
      },
    });
  });

  it("locks visibility when someone else recorded the profile", async () => {
    mockedApi.player.mockResolvedValue(
      player({ created_by: { id: 99, name: "Someone else" } }),
    );
    renderEdit();
    await screen.findByLabelText("Visibility");

    expect(screen.getByLabelText("Visibility")).toBeDisabled();
    expect(
      screen.getByText(/Only the coach who recorded this profile/),
    ).toBeInTheDocument();
  });

  it("lets an admin change visibility on a profile they do not own", async () => {
    mockedApi.me.mockResolvedValue({ ...coachUser, roles: ["admin"] });
    mockedApi.player.mockResolvedValue(
      player({ created_by: { id: 99, name: "Someone else" } }),
    );
    renderEdit();
    await screen.findByLabelText("Visibility");

    expect(screen.getByLabelText("Visibility")).not.toBeDisabled();
  });

  it("PATCHes a coach under the coach_profile key with its visibility", async () => {
    mockedApi.coach.mockResolvedValue(coachRecord());
    mockedApi.updateCoach.mockResolvedValue({
      ...coachRecord({ visibility: "private" }),
      possible_duplicates: [],
    });
    renderEdit("/coaches/7/edit");

    await screen.findByLabelText("Visibility");
    await userEvent.selectOptions(screen.getByLabelText("Visibility"), "private");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockedApi.updateCoach).toHaveBeenCalledWith(7, {
      person: {
        first_name: "Ana",
        last_name: "Coach",
        email: "ana@example.com",
        phone: null,
      },
      coach_profile: {
        coaching_level: null,
        qualifications: null,
        visibility: "private",
      },
    });
    expect(await screen.findByText("Ana Coach saved.")).toBeInTheDocument();
  });
});
