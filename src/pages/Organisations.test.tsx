import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Organisation } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { paginated } from "../test/paginated";
import OrganisationDetail from "./OrganisationDetail";
import Organisations from "./Organisations";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      organisations: vi.fn(),
      organisation: vi.fn(),
      createOrganisation: vi.fn(),
      updateOrganisation: vi.fn(),
      archiveOrganisation: vi.fn(),
      restoreOrganisation: vi.fn(),
      deleteOrganisation: vi.fn(),
      uploadOrganisationLogo: vi.fn(),
      organisationMembers: vi.fn(),
      organisationMemberCandidates: vi.fn(),
      addOrganisationMember: vi.fn(),
      updateOrganisationMember: vi.fn(),
      updateOrganisationMembership: vi.fn(),
      endOrganisationMember: vi.fn(),
      endOrganisationMembership: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = (overrides: Partial<Organisation> = {}): Organisation => ({
  id: 1,
  name: "FIVB",
  slug: "fivb",
  description: null,
  acronym: null,
  organisation_type: "international_federation",
  status: "active",
  status_label: "Active",
  parent_organisation_id: null,
  parent_organisation: null,
  child_count: 0,
  depth: 0,
  logo_url: null,
  logo_attached: false,
  can_edit: false,
  can_delete: false,
  can_manage_members: false,
  can_approve_members: false,
  requires_approval: false,
  approval_required: false,
  created_by_person: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const membership = (overrides = {}) => ({
  id: 10,
  organisation_id: 1,
  person_id: 10,
  person_name: "Alex Owner",
  role: "owner" as const,
  role_label: "Owner",
  status: "active" as const,
  status_label: "Active",
  joined_at: null,
  left_at: null,
  manages: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  impersonation: { active: false, realAdmin: null },
  startImpersonating: vi.fn(),
  stopImpersonating: vi.fn(),
  ...overrides,
});

const adminUser = { id: 1, email: "admin@example.com", roles: ["admin"] } as unknown as AuthContextValue["user"];

const renderWithAuth = (
  ui: React.ReactElement,
  auth: AuthContextValue = authValue(),
  route = "/organisations",
  path = "/organisations",
) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("Organisations tree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedApi.organisations.mockResolvedValue(paginated([organisation()]));
  });

  it("renders organisations as links to their detail pages", async () => {
    renderWithAuth(<Organisations />);

    const link = await screen.findByRole("link", { name: "FIVB" });
    expect(link).toHaveAttribute("href", "/organisations/1");
  });

  it("renders and collapses nested organisations", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB", child_count: 1 }),
        organisation({ id: 2, name: "Volleyball Australia", parent_organisation_id: 1 }),
      ]),
    );
    renderWithAuth(<Organisations />);

    expect(await screen.findByRole("link", { name: "Volleyball Australia" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /collapse fivb/i }));
    expect(screen.queryByRole("link", { name: "Volleyball Australia" })).not.toBeInTheDocument();
  });

  it("passes search and archived filters to the list request", async () => {
    renderWithAuth(<Organisations />);
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByLabelText(/show archived/i));

    await waitFor(() => expect(mockedApi.organisations).toHaveBeenLastCalledWith(undefined, undefined, true));
  });

  it("lets admins create a new organisation", async () => {
    mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 2, name: "New Club" }));
    renderWithAuth(<Organisations />, authValue({ user: adminUser }));
    await screen.findByRole("link", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "New Club");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mockedApi.createOrganisation).toHaveBeenCalledWith(expect.objectContaining({ name: "New Club" }));
    expect(await screen.findByRole("status")).toHaveTextContent("New Club created.");
  });
});

describe("Organisation detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.organisation.mockResolvedValue(organisation({ can_edit: true, can_delete: true, can_manage_members: true }));
    mockedApi.organisations.mockResolvedValue(paginated([organisation({ can_edit: true, can_delete: true, can_manage_members: true })]));
    mockedApi.organisationMembers.mockResolvedValue({ organisation: { id: 1, name: "FIVB" }, data: [membership()] });
  });

  it("loads details and roster", async () => {
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");

    expect(await screen.findByRole("heading", { name: "FIVB" })).toBeInTheDocument();
    expect(await screen.findByText("Alex Owner")).toBeInTheDocument();
  });

  it("edits organisation details", async () => {
    mockedApi.updateOrganisation.mockResolvedValue(organisation({ name: "FIVB Renamed", can_edit: true }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByRole("heading", { name: "FIVB" });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText(/^name$/i);
    await userEvent.clear(name);
    await userEvent.type(name, "FIVB Renamed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(1, expect.objectContaining({ name: "FIVB Renamed" }));
    expect(await screen.findByRole("status")).toHaveTextContent("FIVB Renamed updated.");
  });

  it("updates a roster member role", async () => {
    mockedApi.updateOrganisationMembership.mockResolvedValue(membership({ role: "coach", role_label: "Coach" }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByText("Alex Owner");

    await userEvent.selectOptions(screen.getByLabelText("Role for Alex Owner"), "coach");

    expect(mockedApi.updateOrganisationMembership).toHaveBeenCalledWith(1, 10, { role: "coach" });
    expect(await screen.findByRole("status")).toHaveTextContent("Alex Owner is now Coach.");
  });

  it("adds a searched polymorphic candidate to the roster", async () => {
    mockedApi.organisationMemberCandidates.mockResolvedValue([{ id: "PlayerProfile:77", memberable_type: "PlayerProfile", memberable_id: 77, account_id: null, player_profile_id: 77, coach_profile_id: null, display_name: "Rosa New", member_type_label: "Player profile", account_status: "profile_only" }]);
    mockedApi.addOrganisationMember.mockResolvedValue(membership({ id: 77, memberable_type: "PlayerProfile", memberable_id: 77, person_name: "Rosa New", display_name: "Rosa New", role: "member", role_label: "Member" }));
    renderWithAuth(<OrganisationDetail />, authValue(), "/organisations/1", "/organisations/:id");
    await screen.findByText("Alex Owner");

    await userEvent.click(screen.getByRole("button", { name: /add someone/i }));
    await userEvent.type(screen.getByPlaceholderText("Search by name"), "Ro");
    const row = await screen.findByText("Rosa New");
    await userEvent.click(within(row.closest("li") as HTMLElement).getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mockedApi.organisationMemberCandidates).toHaveBeenCalledWith(1, "Ro");
    expect(mockedApi.addOrganisationMember).toHaveBeenCalledWith(1, { memberable_type: "PlayerProfile", memberable_id: 77 }, { role: "member" });
    expect(await screen.findByRole("status")).toHaveTextContent("Rosa New added to the roster.");
  });
});