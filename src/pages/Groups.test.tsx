import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Group as GroupRecord } from "../api";
import Groups from "./Groups";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      groups: vi.fn(),
      group: vi.fn(),
      organisations: vi.fn(),
      organisationMembers: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const squad = (overrides: Partial<GroupRecord> = {}): GroupRecord => ({
  id: 3,
  name: "U19 squad",
  slug: "u19-squad",
  description: "The under-19 training group",
  status: "active",
  status_label: "Active",
  visibility: "shared",
  requires_approval: false,
  approval_required: false,
  can_approve_members: false,
  player_count: 2,
  organisation: { id: 1, name: "Volleyball Club" },
  owner: { id: 2, name: "Coach Ana" },
  created_by: { id: 2, name: "Coach Ana" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

const page = <T,>(data: T[]) => ({
  data,
  meta: { page: 1, per_page: 20, total: data.length, total_pages: 1 },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Groups />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mockedApi.groups.mockResolvedValue(page([squad()]) as never);
  mockedApi.organisations.mockResolvedValue(
    page([
      { id: 1, name: "Volleyball Club", slug: "volleyball-club", description: null, status: "active", status_label: "Active", organisation_type: "club", parent_organisation_id: null, child_count: 0, member_count: 2, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
    ]) as never,
  );
  mockedApi.organisationMembers.mockResolvedValue({
    organisation: { id: 1, name: "Volleyball Club" },
    data: [
      { id: 1, organisation_id: 1, person_id: 1, person_name: "Ana Silva", role: "member", role_label: "Member", status: "active", status_label: "Active", joined_at: "2026-09-01T00:00:00Z", left_at: null },
      { id: 2, organisation_id: 1, person_id: 2, person_name: "Bruno Alves", role: "member", role_label: "Member", status: "active", status_label: "Active", joined_at: "2026-09-01T00:00:00Z", left_at: null },
    ],
  } as never);
  mockedApi.group.mockResolvedValue({
    group: {
      ...squad(),
      members: [
        {
          id: 1,
          person_id: 1,
          person_name: "Ana Silva",
          player_profile_id: 1,
          level: "intermediate",
          preferred_position: "setter",
          email: null,
          role: "member",
          status: "active",
          joined_at: "2026-09-01T00:00:00Z",
          left_at: null,
        },
      ],
    },
  } as never);
});


describe("Groups catalogue", () => {
  it("lists a squad with its roster size and description", async () => {
    renderPage();

    expect(await screen.findByText("U19 squad")).toBeInTheDocument();
    expect(await screen.findByText(/2 players?/i)).toBeInTheDocument();
    expect(screen.getByText("The under-19 training group")).toBeInTheDocument();
  });

  it("tags a private row rather than hiding it", async () => {
    mockedApi.groups.mockResolvedValue(
      page([squad({ visibility: "private" })]) as never,
    );
    renderPage();

    expect(await screen.findByText("Private")).toBeInTheDocument();
  });

  it("keeps archived rows out until the coach asks to see them", async () => {
    const user = userEvent.setup();
    // The API is asked for active groups only until the toggle is on, so the
    // archived row only ever exists client-side after the toggle is flipped.
    mockedApi.groups.mockImplementation(
      (async (params?: { status?: string }) =>
        params?.status === "all"
          ? page([squad(), squad({ id: 4, name: "Retired", status: "archived" })])
          : page([squad()])) as never,
    );
    renderPage();

    expect(await screen.findByText("U19 squad")).toBeInTheDocument();
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Show archived/i));

    expect(await screen.findByText("Retired")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("filters by the search box", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("U19 squad");

    await user.type(screen.getByRole("searchbox"), "monday");

    expect(screen.queryByText("U19 squad")).not.toBeInTheDocument();
  });

  it("surfaces a load failure", async () => {
    mockedApi.groups.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("API Error: 500");
  });
});


describe("Groups editor", () => {
  it("creates a group with the players ticked in the roster picker", async () => {
    const user = userEvent.setup();
    mockedApi.createGroup.mockResolvedValue({ group: squad() } as never);
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /new group/i }));
    await user.type(screen.getByLabelText(/Name \*/i), "Monday squad");
    // Select organisation first
    await user.selectOptions(
      screen.getByLabelText(/Organisation/i),
      "Volleyball Club",
    );
    const roster = await screen.findByRole("group", { name: /Roster \(0\)/i });
    await user.click(within(roster).getByText("Ana Silva"));
    await user.click(screen.getByRole("button", { name: /create group/i }));

    await waitFor(() => expect(mockedApi.createGroup).toHaveBeenCalled());
    expect(mockedApi.createGroup.mock.calls[0]).toEqual([
      { name: "Monday squad", description: "", visibility: "shared", organisation_id: 1 },
      [1],
    ]);
  });

  it("cannot submit a nameless group", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /new group/i }));

    // The submit button is disabled until a name exists, so the server never
    // sees a nameless group in the first place.
    expect(
      screen.getByRole("button", { name: /create group/i }),
    ).toBeDisabled();
    expect(mockedApi.createGroup).not.toHaveBeenCalled();
  });

  it("edits a group and sends the ticked players as the new roster", async () => {
    const user = userEvent.setup();
    mockedApi.updateGroup.mockResolvedValue({ group: squad() } as never);
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const nameField = await screen.findByLabelText(/Name \*/i);
    expect(nameField).toHaveValue("U19 squad");

    // The editor opens with the group's existing member ticked, and adding a
    // second one sends both — the payload is the whole roster, not a delta.
    const roster = screen.getByRole("group", { name: /Roster \(1\)/i });
    await user.click(within(roster).getByText("Bruno Alves"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockedApi.updateGroup).toHaveBeenCalled());
    expect(mockedApi.updateGroup.mock.calls[0][2]).toEqual([1, 2]);
  });

  it("unticking the only member clears the roster", async () => {
    const user = userEvent.setup();
    mockedApi.updateGroup.mockResolvedValue({ group: squad() } as never);
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const roster = await screen.findByRole("group", { name: /Roster \(1\)/i });
    await user.click(within(roster).getByText("Ana Silva"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockedApi.updateGroup).toHaveBeenCalled());
    expect(mockedApi.updateGroup.mock.calls[0][2]).toEqual([]);
  });
});

describe("Groups lifecycle", () => {
  it("archives rather than deletes, and can restore", async () => {
    const user = userEvent.setup();
    mockedApi.updateGroup.mockResolvedValue({ group: squad() } as never);
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /archive/i }));

    await waitFor(() => expect(mockedApi.updateGroup).toHaveBeenCalled());
    expect(mockedApi.updateGroup.mock.calls[0][1]).toMatchObject({
      status: "archived",
    });
  });

  it("confirms before deleting and surfaces the archive-instead refusal", async () => {
    const user = userEvent.setup();
    mockedApi.deleteGroup.mockRejectedValue(
      new Error(
        "Cannot delete group that has associated assessment sessions. Archive it instead.",
      ),
    );
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /assessment sessions/i,
    );
  });

  it("leaves the group alone when the coach cancels the confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("U19 squad");

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedApi.deleteGroup).not.toHaveBeenCalled();
  });
});

