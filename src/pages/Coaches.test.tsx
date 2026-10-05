import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Coach } from "../api";
import { paginated } from "../test/paginated";
import Coaches from "./Coaches";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      coaches: vi.fn(),
      people: vi.fn(),
      createCoach: vi.fn(),
      updateCoach: vi.fn(),
      organisations: vi.fn(),
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

const coach = (overrides: Partial<Coach> & { id: number }): Coach => ({
  person_id: overrides.id * 10,
  coaching_level: null,
  qualifications: null,
  status: "active",
  visibility: "shared",
  created_by: { id: 2, name: "Coach" },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  account_status: "profile_only",
  full_name: "New Coach",
  person: {
    id: overrides.id * 10,
    first_name: "New",
    last_name: "Coach",
    email: null,
    phone: null,
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const renderCoaches = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Coaches />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.coaches.mockResolvedValue(paginated([]));
  mockedApi.people.mockResolvedValue([]);
  mockedApi.organisations.mockResolvedValue(paginated([]));
});

afterEach(() => vi.clearAllMocks());

describe("Coaches", () => {
  it("now offers the accountless mode when recording a coach", async () => {
    // Phase 18 reversed Phase 2's rule: a coach recorded with only a display
    // name is the state a claim invitation is issued against.
    renderCoaches();
    await userEvent.click(
      await screen.findByRole("button", { name: "New coach" }),
    );

    expect(
      screen.getByRole("radio", { name: /no details yet/i }),
    ).toBeInTheDocument();
  });

  it("lists coaches with their details and account status", async () => {
    mockedApi.coaches.mockResolvedValue(
      paginated([
        coach({
          id: 1,
          full_name: "Olga Coach",
          coaching_level: "state",
          qualifications: "Level 1",
        }),
      ]),
    );
    renderCoaches();

    expect(await screen.findByText("Olga Coach")).toBeInTheDocument();
    expect(screen.getByText("state · Level 1")).toBeInTheDocument();
    expect(screen.getByText("Profile only")).toBeInTheDocument();
  });

  it("searches coaches server-side", async () => {
    renderCoaches();
    await screen.findByLabelText("Search coaches");

    await userEvent.type(screen.getByLabelText("Search coaches"), "olga");

    expect(mockedApi.coaches).toHaveBeenLastCalledWith({
      q: "olga",
      status: "active",
      page: 1,
      per_page: 20,
    });
  });

  it("pages through the catalogue 20 at a time", async () => {
    mockedApi.coaches.mockResolvedValue(
      paginated([coach({ id: 1, full_name: "First Page" })], {
        total: 21,
        total_pages: 2,
      }),
    );
    renderCoaches();
    await screen.findByText("First Page");

    mockedApi.coaches.mockResolvedValue(
      paginated([coach({ id: 2, full_name: "Second Page" })], {
        page: 2,
        total: 21,
        total_pages: 2,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(mockedApi.coaches).toHaveBeenLastCalledWith({
      status: "active",
      page: 2,
      per_page: 20,
    });
    expect(await screen.findByText("Second Page")).toBeInTheDocument();
  });

  it("shows archived coaches and offers to restore them", async () => {
    mockedApi.coaches.mockResolvedValue(
      paginated([
        coach({ id: 9, full_name: "Retired Coach", status: "archived" }),
      ]),
    );
    renderCoaches();
    await screen.findByText("Retired Coach");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Show archived/ }),
    );

    expect(mockedApi.coaches).toHaveBeenLastCalledWith({
      status: "archived",
      page: 1,
      per_page: 20,
    });
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore Retired Coach" }),
    ).toBeInTheDocument();
  });

  it("archives a coach only after confirming", async () => {
    mockedApi.coaches.mockResolvedValue(
      paginated([coach({ id: 4, full_name: "Olga Coach" })]),
    );
    mockedApi.updateCoach.mockResolvedValue({
      ...coach({ id: 4, status: "archived" }),
      possible_duplicates: [],
    });
    renderCoaches();
    await screen.findByText("Olga Coach");

    await userEvent.click(
      screen.getByRole("button", { name: "Archive Olga Coach" }),
    );
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Archive",
      }),
    );

    expect(mockedApi.updateCoach).toHaveBeenCalledWith(4, {
      coach_profile: { status: "archived" },
    });
  });

  it("records an accountless coach with their profile fields", async () => {
    mockedApi.createCoach.mockResolvedValue({
      ...coach({ id: 4 }),
      possible_duplicates: [],
    });
    renderCoaches();

    await userEvent.click(
      await screen.findByRole("button", { name: /New coach/ }),
    );
    await userEvent.type(screen.getByLabelText("First name"), "New");
    await userEvent.type(screen.getByLabelText("Coaching level"), "national");
    await userEvent.click(screen.getByRole("button", { name: "Add coach" }));

    expect(mockedApi.createCoach).toHaveBeenCalledWith({
      person_id: undefined,
      person: {
        first_name: "New",
        last_name: null,
        email: null,
        phone: null,
        organisation_memberships_attributes: [],
      },
      coach_profile: {
        coaching_level: "national",
        qualifications: null,
        visibility: "shared",
      },
    });
    expect(
      await screen.findByText("New Coach is now a coach"),
    ).toBeInTheDocument();
  });

  it("can add another CoachProfile to a Person who is already a coach", async () => {
    mockedApi.people.mockResolvedValue([
      {
        id: 42,
        first_name: "Sam",
        last_name: "Coach",
        full_name: "Sam Coach",
        email: "sam@example.com",
        phone: null,
        date_of_birth: null,
        creation_source: "signup",
        account_status: "connected",
        player_profile_id: null,
        coach_profile_id: 7,
        player_profile_ids: [],
        coach_profile_ids: [7],
      },
    ]);
    mockedApi.createCoach.mockResolvedValue({
      ...coach({ id: 8, person_id: 42, full_name: "Sam Coach" }),
      possible_duplicates: [],
    });
    renderCoaches();

    await userEvent.click(await screen.findByRole("button", { name: /New coach/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search people" }), "Sam");
    await userEvent.click(await screen.findByRole("button", { name: "Add another coach profile" }));
    await userEvent.type(screen.getByLabelText("Coaching level"), "national");
    await userEvent.click(screen.getByRole("button", { name: "Add coach" }));

    await waitFor(() =>
      expect(mockedApi.createCoach).toHaveBeenCalledWith({
        person_id: 42,
        person: undefined,
        coach_profile: {
          coaching_level: "national",
          qualifications: null,
          visibility: "shared",
        },
      }),
    );
  });

  it("offers an edit link per coach", async () => {
    mockedApi.coaches.mockResolvedValue(
      paginated([coach({ id: 1, full_name: "Olga Coach" })]),
    );
    renderCoaches();

    expect(
      await screen.findByRole("link", { name: "Edit Olga Coach" }),
    ).toHaveAttribute("href", "/coaches/1/edit");
  });

  it("hides the create button from a curator", async () => {
    mockedApi.me.mockResolvedValue({
      id: 4,
      name: "Curator",
      email_address: "curator@x.com",
      roles: ["curator"],
    });
    mockedApi.coaches.mockResolvedValue(paginated([coach({ id: 1 })]));
    renderCoaches();

    await screen.findByLabelText("Search coaches");
    expect(
      screen.queryByRole("button", { name: /New coach/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Edit / })).not.toBeInTheDocument();
  });
});
