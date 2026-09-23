import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import {
  ApiValidationError,
  api,
  type PersonIdentity,
  type Player,
} from "../api";
import { paginated } from "../test/paginated";
import Players from "./Players";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      players: vi.fn(),
      people: vi.fn(),
      createPlayer: vi.fn(),
      updatePlayer: vi.fn(),
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

const player = (overrides: Partial<Player> & { id: number }): Player => ({
  person_id: overrides.id * 10,
  preferred_position: null,
  level: null,
  status: "active",
  visibility: "shared",
  created_by: { id: 2, name: "Coach" },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  account_status: "profile_only",
  full_name: "Pedro Santos",
  person: {
    id: overrides.id * 10,
    first_name: "Pedro",
    last_name: "Santos",
    email: null,
    phone: null,
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const person = (
  overrides: Partial<PersonIdentity> & { id: number },
): PersonIdentity => ({
  first_name: "Pedro",
  last_name: "Santos",
  full_name: "Pedro Santos",
  email: "pedro@example.com",
  phone: null,
  date_of_birth: null,
  creation_source: "coach_created",
  account_status: "profile_only",
  player_profile_id: null,
  coach_profile_id: null,
  ...overrides,
});

const renderPlayers = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Players />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.players.mockResolvedValue(paginated([]));
  mockedApi.people.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe("Players", () => {
  it("lists players with their account status", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([
        player({
          id: 1,
          full_name: "Maria Silva",
          preferred_position: "setter",
          level: "intermediate",
          account_status: "connected",
        }),
      ]),
    );
    renderPlayers();

    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("setter · intermediate")).toBeInTheDocument();
    expect(screen.getByText("Account connected")).toBeInTheDocument();
  });

  it("searches players server-side and returns to page one", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 1 })], { total: 40, total_pages: 2 }),
    );
    renderPlayers();
    await screen.findByLabelText("Search players");

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(mockedApi.players).toHaveBeenLastCalledWith({
      status: "active",
      page: 2,
      per_page: 20,
    });

    await userEvent.type(screen.getByLabelText("Search players"), "pedro");
    expect(mockedApi.players).toHaveBeenLastCalledWith({
      q: "pedro",
      status: "active",
      page: 1,
      per_page: 20,
    });
  });

  it("pages through the catalogue 20 at a time", async () => {
    mockedApi.players.mockResolvedValue(
      paginated(
        Array.from({ length: 20 }, (_, index) =>
          player({ id: index + 1, full_name: `Player ${index + 1}` }),
        ),
        { total: 21, total_pages: 2 },
      ),
    );
    renderPlayers();
    await screen.findByText("Player 1");

    expect(screen.getByText(/Showing/).parentElement).toHaveTextContent(
      "Showing 1–20 of 21",
    );

    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 21, full_name: "Last Player" })], {
        page: 2,
        total: 21,
        total_pages: 2,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));

    expect(mockedApi.players).toHaveBeenLastCalledWith({
      status: "active",
      page: 2,
      per_page: 20,
    });
    expect(await screen.findByText("Last Player")).toBeInTheDocument();
    expect(screen.queryByText("Player 1")).not.toBeInTheDocument();
  });

  it("shows archived players and offers to restore them", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 3, full_name: "Gone Away", status: "archived" })]),
    );
    renderPlayers();
    await screen.findByText("Gone Away");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Show archived/ }),
    );

    expect(mockedApi.players).toHaveBeenLastCalledWith({
      status: "archived",
      page: 1,
      per_page: 20,
    });
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore Gone Away" }),
    ).toBeInTheDocument();
    // Archived rows are restored, not archived again.
    expect(
      screen.queryByRole("button", { name: "Archive Gone Away" }),
    ).not.toBeInTheDocument();
  });

  it("archives a player only after confirming", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 5, full_name: "Maria Silva" })]),
    );
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ id: 5, status: "archived" }),
      possible_duplicates: [],
    });
    renderPlayers();
    await screen.findByText("Maria Silva");

    await userEvent.click(
      screen.getByRole("button", { name: "Archive Maria Silva" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/training history is kept/);

    // Cancelling must not touch the API.
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mockedApi.updatePlayer).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Archive Maria Silva" }),
    );
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Archive",
      }),
    );

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(5, {
      player_profile: { status: "archived" },
    });
  });

  it("restores a player from the archived view", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 6, full_name: "Back Soon", status: "archived" })]),
    );
    mockedApi.updatePlayer.mockResolvedValue({
      ...player({ id: 6, status: "active" }),
      possible_duplicates: [],
    });
    renderPlayers();
    await screen.findByText("Back Soon");

    await userEvent.click(
      screen.getByRole("button", { name: "Restore Back Soon" }),
    );

    expect(mockedApi.updatePlayer).toHaveBeenCalledWith(6, {
      player_profile: { status: "active" },
    });
  });

  it("offers an edit link per player", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 7, full_name: "Maria Silva" })]),
    );
    renderPlayers();

    expect(
      await screen.findByRole("link", { name: "Edit Maria Silva" }),
    ).toHaveAttribute("href", "/players/7/edit");
  });

  it("reports an empty search result", async () => {
    renderPlayers();
    await screen.findByLabelText("Search players");

    await userEvent.type(screen.getByLabelText("Search players"), "zzz");

    expect(
      await screen.findByText("No player matches “zzz”."),
    ).toBeInTheDocument();
  });

  it("marks private players in the list", async () => {
    mockedApi.players.mockResolvedValue(
      paginated([player({ id: 5, visibility: "private" })]),
    );
    renderPlayers();

    expect(await screen.findByText("Pedro Santos")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("links an existing person instead of recording a duplicate", async () => {
    mockedApi.people.mockResolvedValue([person({ id: 42 })]);
    mockedApi.createPlayer.mockResolvedValue({
      ...player({ id: 9 }),
      possible_duplicates: [],
    });
    renderPlayers();

    await userEvent.click(
      await screen.findByRole("button", { name: /New player/ }),
    );
    await userEvent.type(screen.getByLabelText("Search people"), "pedro");
    const match = await screen.findByText("Pedro Santos");
    await userEvent.click(
      within(match.closest("li")!).getByRole("button", {
        name: "Use this person",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add player" }));

    expect(mockedApi.createPlayer).toHaveBeenCalledWith({
      person_id: 42,
      person: undefined,
      player_profile: {
        preferred_position: null,
        level: null,
        visibility: "shared",
      },
    });
  });

  it("shows possible duplicates after recording a new person without merging", async () => {
    mockedApi.createPlayer.mockResolvedValue({
      ...player({ id: 9 }),
      possible_duplicates: [person({ id: 77 })],
    });
    renderPlayers();

    await userEvent.click(
      await screen.findByRole("button", { name: /New player/ }),
    );
    await userEvent.type(screen.getByLabelText("First name"), "Pedro");
    await userEvent.type(screen.getByLabelText("Last name"), "Santos");
    await userEvent.click(screen.getByRole("button", { name: "Add player" }));

    expect(mockedApi.createPlayer).toHaveBeenCalledWith({
      person_id: undefined,
      person: {
        first_name: "Pedro",
        last_name: "Santos",
        email: null,
        phone: null,
      },
      player_profile: {
        preferred_position: null,
        level: null,
        visibility: "shared",
      },
    });
    expect(
      await screen.findByText(/merged automatically/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pedro Santos is now a player"),
    ).toBeInTheDocument();
  });

  it("surfaces API validation errors", async () => {
    mockedApi.createPlayer.mockRejectedValue(
      new ApiValidationError(["First name can't be blank"]),
    );
    renderPlayers();

    await userEvent.click(
      await screen.findByRole("button", { name: /New player/ }),
    );
    await userEvent.type(screen.getByLabelText("First name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add player" }));

    expect(
      await screen.findByText("First name can't be blank"),
    ).toBeInTheDocument();
  });

  it("hides the create button from a player account", async () => {
    mockedApi.me.mockResolvedValue({
      id: 5,
      name: "Player",
      email_address: "player@x.com",
      roles: ["player"],
    });
    renderPlayers();

    await screen.findByLabelText("Search players");
    expect(
      screen.queryByRole("button", { name: /New player/ }),
    ).not.toBeInTheDocument();
  });
});
