import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type PersonIdentity } from "../api";
import { paginated } from "../test/paginated";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import People from "./People";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      peopleList: vi.fn(),
      createPerson: vi.fn(),
      updatePerson: vi.fn(),
      deletePerson: vi.fn(),
      promotePerson: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const person = (over: Partial<PersonIdentity> = {}): PersonIdentity => ({
  id: 1,
  first_name: "Rosa",
  last_name: "New",
  full_name: "Rosa New",
  email: "rosa@example.com",
  phone: null,
  date_of_birth: null,
  creation_source: "system",
  account_status: "profile_only",
  player_profile_id: null,
  coach_profile_id: null,
  ...over,
});

const adminUser = {
  id: 1,
  email: "admin@example.com",
  roles: ["admin"],
} as unknown as AuthContextValue["user"];

const coachUser = {
  id: 2,
  email: "coach@example.com",
  roles: ["coach"],
} as unknown as AuthContextValue["user"];

const authValue = (over: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
  ...over,
});

const renderPage = (user: AuthContextValue["user"] = adminUser) =>
  render(
    <AuthContext.Provider value={authValue({ user })}>
      <MemoryRouter>
        <People />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.peopleList.mockResolvedValue(paginated([person()]));
});

describe("People", () => {
  it("lists people from the paginated endpoint", async () => {
    mockedApi.peopleList.mockResolvedValue(
      paginated([person(), person({ id: 2, first_name: "Alex", full_name: "Alex Two" })]),
    );
    renderPage();

    expect(await screen.findByText("Rosa New")).toBeInTheDocument();
    expect(screen.getByText("Alex Two")).toBeInTheDocument();
    expect(mockedApi.peopleList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 20 }),
    );
  });

  it("shows whether somebody is a player, a coach, or neither", async () => {
    mockedApi.peopleList.mockResolvedValue(
      paginated([
        person({
          id: 1,
          first_name: "Alex",
          last_name: "Plays",
          full_name: "Alex Plays",
          account_status: "connected",
          player_profile_id: 5,
        }),
        person({ id: 2, first_name: "Rosa", full_name: "Rosa Committee" }),
      ]),
    );
    renderPage();

    // The point of the catalogue: a person with no profile at all is still listed.
    expect(await screen.findByText("Alex Plays")).toBeInTheDocument();
    expect(screen.getByText("Rosa Committee")).toBeInTheDocument();
    expect(screen.getByText("Player")).toBeInTheDocument();
    expect(screen.getByText("Has account")).toBeInTheDocument();
    expect(screen.getByText("Record only")).toBeInTheDocument();
  });

  it("creates a person", async () => {
    mockedApi.createPerson.mockResolvedValue(person({ full_name: "Newly Added" }));
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /new person/i }));
    await userEvent.type(screen.getByLabelText(/first name/i), "Newly");
    await userEvent.type(screen.getByLabelText(/last name/i), "Added");
    await userEvent.click(screen.getByRole("button", { name: /add person/i }));

    await waitFor(() =>
      expect(mockedApi.createPerson).toHaveBeenCalledWith({
        first_name: "Newly",
        last_name: "Added",
        email: null,
        phone: null,
      }),
    );
    expect(await screen.findByText(/Newly Added added/)).toBeInTheDocument();
  });

  it("refuses a person with no first name", async () => {
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /new person/i }));
    await userEvent.click(screen.getByRole("button", { name: /add person/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/first name/i);
    expect(mockedApi.createPerson).not.toHaveBeenCalled();
  });

  it("edits a person in place", async () => {
    mockedApi.updatePerson.mockResolvedValue(
      person({ last_name: "Renamed", full_name: "Rosa Renamed" }),
    );
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const lastName = screen.getByLabelText(/last name/i);
    await userEvent.clear(lastName);
    await userEvent.type(lastName, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockedApi.updatePerson).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ last_name: "Renamed" }),
      ),
    );
  });
  // --- promotion: admin only ------------------------------------------------

  it("offers promotion only to an admin", async () => {
    renderPage(adminUser);
    await screen.findByText("Rosa New");

    expect(screen.getByRole("button", { name: /make player/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /make coach/i })).toBeInTheDocument();
  });

  it("hides promotion and delete from a non-admin coach", async () => {
    renderPage(coachUser);
    await screen.findByText("Rosa New");

    expect(screen.queryByRole("button", { name: /make player/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    // Editing a person is ordinary content work, so a coach keeps it.
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("promotes a person to player", async () => {
    mockedApi.promotePerson.mockResolvedValue({
      ...person(),
      player_profile_id: 9,
      profile_id: 9,
      profile_kind: "player",
    } as never);
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /make player/i }));

    await waitFor(() => expect(mockedApi.promotePerson).toHaveBeenCalledWith(1, "player"));
    expect(await screen.findByText(/now recorded as a player/)).toBeInTheDocument();
  });

  it("offers to make somebody a coach when they are already a player", async () => {
    mockedApi.peopleList.mockResolvedValue(paginated([person({ player_profile_id: 5 })]));
    renderPage();
    await screen.findByText("Rosa New");

    // One person may be both a player and a coach, so the coach offer stays.
    expect(screen.queryByRole("button", { name: /make player/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /make coach/i })).toBeInTheDocument();
  });

  it("surfaces a refusal from the server when promoting", async () => {
    mockedApi.promotePerson.mockRejectedValue(
      new Error("API Error: 409 Rosa New is already a player"),
    );
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /make player/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already a player/i);
  });

  // --- delete ---------------------------------------------------------------

  it("deletes a person after confirmation", async () => {
    mockedApi.deletePerson.mockResolvedValue({ message: "Person deleted", id: 1 });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockedApi.deletePerson).toHaveBeenCalledWith(1));
  });

  it("does nothing when deletion is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("Rosa New");

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedApi.deletePerson).not.toHaveBeenCalled();
  });

  it("offers delete only to somebody with no account", async () => {
    // The server refuses to delete a person who has an account — a login must not
    // be silently orphaned — so a button for them could only ever return a 422.
    mockedApi.peopleList.mockResolvedValue(
      paginated([
        person({ id: 1, first_name: "No", last_name: "Account", full_name: "No Account" }),
        person({
          id: 2,
          first_name: "Has",
          last_name: "Account",
          full_name: "Has Account",
          account_status: "connected",
        }),
      ]),
    );
    renderPage();
    await screen.findByText("No Account");

    // Exactly one, on the row that can actually be deleted.
    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(1);
  });

  // --- search ---------------------------------------------------------------

  it("searches on submit rather than on every keystroke", async () => {
    renderPage();
    await screen.findByText("Rosa New");
    mockedApi.peopleList.mockClear();

    await userEvent.type(screen.getByLabelText(/search people/i), "Zed");
    expect(mockedApi.peopleList).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() =>
      expect(mockedApi.peopleList).toHaveBeenCalledWith(
        expect.objectContaining({ q: "Zed", page: 1 }),
      ),
    );
  });

  it("surfaces a load failure instead of an empty page", async () => {
    mockedApi.peopleList.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("API Error: 500");
  });
});
