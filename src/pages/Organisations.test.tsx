import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Organisation, type OrganisationMembership } from "../api";
import { paginated } from "../test/paginated";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import Organisations from "./Organisations";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      organisations: vi.fn(),
      createOrganisation: vi.fn(),
      archiveOrganisation: vi.fn(),
      restoreOrganisation: vi.fn(),
      uploadOrganisationLogo: vi.fn(),
      deleteOrganisation: vi.fn(),
      updateOrganisation: vi.fn(),
      organisationMembers: vi.fn(),
      addOrganisationMember: vi.fn(),
      updateOrganisationMember: vi.fn(),
      endOrganisationMember: vi.fn(),
      people: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const organisation = (
  overrides: Partial<Organisation> = {},
): Organisation => ({
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
  created_by_person: null,
  created_at: "",
  updated_at: "",
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

const adminUser = {
  id: 1,
  email: "admin@example.com",
  roles: ["admin"],
} as unknown as AuthContextValue["user"];

// A training manager who is not an admin. This is deliberately a separate user: a
// club's owner can be a plain coach, and the point of these tests is that edit
// rights are per organisation rather than per role.
const coachUser = {
  id: 2,
  email: "coach@example.com",
  roles: ["coach"],
} as unknown as AuthContextValue["user"];

const renderPage = (auth: AuthContextValue = authValue()) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <Organisations />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

const pngFile = () => new File(["x"], "logo.png", { type: "image/png" });

/**
 * Render the list as the server would return it to somebody who may edit it.
 *
 * The controls are driven by the per-row `can_edit` flag rather than by the user's
 * role, because "may edit" genuinely varies per organisation — a club's owner can
 * edit their own club and nothing else. A test that exercises those controls
 * therefore has to set the flag, exactly as the real response carries it.
 */
const withEditableRows = () =>
  mockedApi.organisations.mockResolvedValue(
    paginated([organisation({ can_edit: true, can_manage_members: true })]),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.organisations.mockResolvedValue(paginated([organisation()]));
});

describe("Organisations", () => {
  it("renders an initials fallback rather than a broken image when there is no logo", async () => {
    renderPage();

    expect(await screen.findByText("FIVB")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("FI")).toBeInTheDocument();
  });

  it("shows the uploaded logo when there is one", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({
          logo_url: "http://localhost:3000/rails/active_storage/blobs/abc/logo.png",
          logo_attached: true,
        }),
      ]),
    );
    renderPage();

    const logo = await screen.findByRole("img", { name: /FIVB logo/i });
    expect(logo).toHaveAttribute(
      "src",
      "http://localhost:3000/rails/active_storage/blobs/abc/logo.png",
    );
    // No initials fallback once a real logo exists.
    expect(screen.queryByText("FI")).not.toBeInTheDocument();
  });

  it("indents each tier so the hierarchy is readable without assuming a depth", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB" }),
        organisation({
          id: 2,
          name: "Volleyball Australia",
          parent_organisation_id: 1,
          depth: 1,
        }),
        organisation({
          id: 3,
          name: "Sydney Beach Volleyball Club",
          parent_organisation_id: 2,
          depth: 2,
        }),
      ]),
    );
    renderPage();

    await screen.findByText("Sydney Beach Volleyball Club");
    const rows = document.querySelectorAll(".organisations-row");
    expect(rows).toHaveLength(3);
    expect((rows[0] as HTMLElement).style.paddingLeft).toBe("0rem");
    expect((rows[1] as HTMLElement).style.paddingLeft).toBe("1.5rem");
    expect((rows[2] as HTMLElement).style.paddingLeft).toBe("3rem");
  });

  it("uploads a logo and confirms it in words", async () => {
    mockedApi.uploadOrganisationLogo.mockResolvedValue(
      organisation({ logo_url: "http://example.test/logo.png", logo_attached: true }),
    );
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.upload(screen.getByLabelText("Upload logo for FIVB"), pngFile());

    await waitFor(() =>
      expect(mockedApi.uploadOrganisationLogo).toHaveBeenCalledWith(
        1,
        expect.any(File),
      ),
    );
    // An upload must never be a silent no-op.
    expect(await screen.findByRole("status")).toHaveTextContent(/logo updated/i);
  });

  it("refuses an unsupported file before sending it", async () => {
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    // Fired directly rather than via userEvent.upload, which silently skips a file
    // the input's `accept` attribute excludes — so the guard under test would never
    // run. This is the case a caller can still hit through drag-and-drop.
    const input = screen.getByLabelText("Upload logo for FIVB");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "notes.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/must be a PNG/i);
    expect(mockedApi.uploadOrganisationLogo).not.toHaveBeenCalled();
  });

  it("refuses an oversized file before sending it", async () => {
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    const oversized = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Upload logo for FIVB"), {
      target: { files: [oversized] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/smaller than 10 MB/i);
    expect(mockedApi.uploadOrganisationLogo).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from the server rather than swallowing it", async () => {
    mockedApi.uploadOrganisationLogo.mockRejectedValue(
      new Error("Logo must be smaller than 10 MB"),
    );
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.upload(screen.getByLabelText("Upload logo for FIVB"), pngFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(/smaller than 10 MB/i);
  });

  it("hides the upload and management controls from a non-admin", async () => {
    renderPage();

    expect(await screen.findByText("FIVB")).toBeInTheDocument();
    expect(screen.queryByLabelText("Upload logo for FIVB")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /new organisation/i }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a load failure instead of an empty page", async () => {
    mockedApi.organisations.mockRejectedValue(new Error("API Error: 500"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("API Error: 500");
  });

  // --- edit ------------------------------------------------------------------

  it("opens an edit form on the row and saves the new name", async () => {
    mockedApi.updateOrganisation.mockResolvedValue(
      organisation({ name: "FIVB Renamed", can_edit: true }),
    );
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByDisplayValue("FIVB");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "FIVB Renamed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(1, {
      name: "FIVB Renamed",
      acronym: null,
      description: null,
      organisation_type: "international_federation",
      // An admin's save always states the parent, so clearing the field reaches the
      // server as an explicit detach rather than as "leave it alone".
      parent_organisation_id: null,
    });
    expect(await screen.findByText("FIVB Renamed updated.")).toBeInTheDocument();
  });

  it("does not offer editing a row the server marked as not editable", async () => {
    withEditableRows(); // every row can_edit: true
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB", can_edit: true }),
        organisation({ id: 2, name: "Sydney Beach Club", can_edit: false }),
      ]),
    );
    renderPage(authValue({ user: adminUser }));

    await screen.findByText("FIVB");
    // Exactly one Edit, on the editable row only.
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("refuses to save an empty name", async () => {
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByDisplayValue("FIVB"));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/give the organisation a name/i);
    expect(mockedApi.updateOrganisation).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from the server when saving", async () => {
    mockedApi.updateOrganisation.mockRejectedValue(
      new Error("API Error: 422 Name has already been taken"),
    );
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByDisplayValue("FIVB");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Taken Name");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already been taken/i);
    // The form stays open so the edit is not lost.
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("cancelling closes the form without saving", async () => {
    withEditableRows();
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(mockedApi.updateOrganisation).not.toHaveBeenCalled();
  });

  // --- roster ----------------------------------------------------------------

  describe("roster", () => {
    const membership = (over: Partial<OrganisationMembership> = {}) =>
      ({
        id: 1,
        organisation_id: 1,
        person_id: 10,
        person_name: "Alex Owner",
        role: "owner",
        role_label: "Owner",
        status: "active",
        status_label: "Active",
        joined_at: "2026-01-01T00:00:00Z",
        left_at: null,
        manages: true,
        created_at: "",
        updated_at: "",
        ...over,
      }) as OrganisationMembership;

    // `data` defaults to one active member but is overridable, because several
    // tests set their own mock *before* calling this and must not have it
    // overwritten here.
    const openRoster = async (
      user = adminUser,
      data: OrganisationMembership[] = [membership()],
    ) => {
      withEditableRows();
      mockedApi.organisationMembers.mockResolvedValue({
        organisation: { id: 1, name: "FIVB" },
        data,
      });
      renderPage(authValue({ user }));
      await screen.findByText("FIVB");
      await userEvent.click(screen.getByRole("button", { name: /members/i }));
    };

    it("lists the roster when opened", async () => {
      await openRoster();

      expect(await screen.findByText("Alex Owner")).toBeInTheDocument();
      expect(mockedApi.organisationMembers).toHaveBeenCalledWith(1);
    });

    it("separates not-yet-active from members, and always shows the group", async () => {
      // Rendering the group even when empty is deliberate: an empty group and an
      // absent one look identical, and that ambiguity is what made the delete guard
      // unreadable in the first place.
      // Passed through the helper rather than mocked beforehand: `openRoster`
      // overwrites the mock, so setting it first would be silently discarded.
      await openRoster(
        adminUser,
        [
          membership({ id: 1, person_id: 10, person_name: "Alex Owner" }),
          membership({
            id: 2,
            person_id: 11,
            person_name: "Casey Prospective",
            role: "member",
            role_label: "Member",
            status: "pending",
            status_label: "Pending",
            manages: false,
          }),
        ],
      );

      expect(await screen.findByText("Not yet active (1)")).toBeInTheDocument();
      expect(screen.getByText("Members (1)")).toBeInTheDocument();
      expect(screen.getByText("Casey Prospective")).toBeInTheDocument();
    });

    it("says so when nobody is recorded but not yet active", async () => {
      await openRoster();

      expect(await screen.findByText("Not yet active (0)")).toBeInTheDocument();
      expect(
        screen.getByText("Nobody is recorded but not yet active."),
      ).toBeInTheDocument();
    });

    it("adds somebody as an active member, with no status of its own", async () => {
      // The UI deliberately sends no `status` and lets the server default stand, so
      // there is one source of truth for what adding means rather than two that can
      // drift. The server makes it active immediately.
      mockedApi.people.mockResolvedValue([
        { id: 77, full_name: "Rosa New", first_name: "Rosa", last_name: "New" },
      ] as never);
      mockedApi.addOrganisationMember.mockResolvedValue(
        membership({ id: 3, person_id: 77, person_name: "Rosa New", status: "active" }),
      );
      await openRoster();

      await userEvent.click(await screen.findByRole("button", { name: /add someone/i }));
      await userEvent.type(screen.getByPlaceholderText("Search by name"), "Ro");
      await userEvent.click(await screen.findByRole("button", { name: "Add" }));

      await waitFor(() =>
        expect(mockedApi.addOrganisationMember).toHaveBeenCalledWith(1, 77, { role: "member" }),
      );
      // No `status` in the payload: "pending" is no longer a thing adding produces.
      const [, , payload] = mockedApi.addOrganisationMember.mock.calls[0];
      expect(payload).not.toHaveProperty("status");
    });

    it("changes a role", async () => {
      mockedApi.updateOrganisationMember.mockResolvedValue(
        membership({ role: "coach", role_label: "Coach" }),
      );
      await openRoster();

      await userEvent.selectOptions(
        await screen.findByLabelText("Role for Alex Owner"),
        "coach",
      );

      expect(mockedApi.updateOrganisationMember).toHaveBeenCalledWith(1, 10, { role: "coach" });
      expect(await screen.findByText(/is now Coach/)).toBeInTheDocument();
    });

    it("removes a not-yet-active record and drops it from the list", async () => {
      mockedApi.endOrganisationMember.mockResolvedValue({
        removed: true,
        person_id: 11,
        message: "Invitation to Casey Prospective withdrawn.",
      });
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      await openRoster(adminUser, [
        membership({
          id: 2,
          person_id: 11,
          person_name: "Casey Prospective",
          role: "member",
          role_label: "Member",
          status: "pending",
          status_label: "Pending",
          manages: false,
        }),
      ]);

      await userEvent.click(await screen.findByRole("button", { name: "Remove" }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockedApi.endOrganisationMember).toHaveBeenCalledWith(1, 11);
      expect(await screen.findByText(/Invitation to Casey/)).toBeInTheDocument();
      expect(screen.queryByText("Casey Prospective")).not.toBeInTheDocument();
    });

    it("keeps a real member on the roster when they are removed", async () => {
      // The row survives as `ended`, so the panel shows them under former members
      // rather than pretending they never were.
      mockedApi.endOrganisationMember.mockResolvedValue({
        removed: false,
        membership: membership({ status: "ended", status_label: "Ended" }),
      });
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await openRoster();

      await userEvent.click(await screen.findByRole("button", { name: "Remove" }));

      expect(await screen.findByText("Former members (1)")).toBeInTheDocument();
      expect(screen.getByText("Alex Owner")).toBeInTheDocument();
    });

    it("hides the add and role controls from a viewer who cannot manage", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([
          // Editable but not an officer: the case that used to render controls the
          // server refused.
          organisation({ name: "FIVB", can_edit: true, can_manage_members: false }),
        ]),
      );
      mockedApi.organisationMembers.mockResolvedValue({
        organisation: { id: 1, name: "FIVB" },
        data: [membership()],
      });
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("FIVB");
      await userEvent.click(screen.getByRole("button", { name: /members/i }));

      expect(await screen.findByText("Alex Owner")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /add someone/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Role for Alex Owner")).not.toBeInTheDocument();
    });

    it("adds a person found by searching", async () => {
      mockedApi.people.mockResolvedValue([
        { id: 77, full_name: "Rosa New", first_name: "Rosa", last_name: "New" },
      ] as never);
      mockedApi.addOrganisationMember.mockResolvedValue(
        membership({ id: 3, person_id: 77, person_name: "Rosa New", role: "coach" }),
      );
      await openRoster();

      await userEvent.click(await screen.findByRole("button", { name: /add someone/i }));
      await userEvent.type(screen.getByPlaceholderText("Search by name"), "Ro");
      expect(await screen.findByText("Rosa New")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(mockedApi.addOrganisationMember).toHaveBeenCalledWith(1, 77, { role: "member" });
      expect(await screen.findByText(/Rosa New added to the roster/)).toBeInTheDocument();
    });

    it("marks somebody already on the roster as not re-addable", async () => {
      mockedApi.people.mockResolvedValue([
        { id: 10, full_name: "Alex Owner", first_name: "Alex", last_name: "Owner" },
      ] as never);
      await openRoster();

      await userEvent.click(await screen.findByRole("button", { name: /add someone/i }));
      await userEvent.type(screen.getByPlaceholderText("Search by name"), "Ale");

      expect(await screen.findByText("Already on roster")).toBeDisabled();
    });

    it("surfaces a roster that fails to load", async () => {
      mockedApi.organisationMembers.mockRejectedValue(new Error("API Error: 403 Forbidden"));
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("FIVB");
      await userEvent.click(screen.getByRole("button", { name: /members/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/403/);
    });
  });

  // --- the create form -------------------------------------------------------

  describe("new organisation", () => {
    const openNew = async (user = adminUser) => {
      withEditableRows();
      renderPage(authValue({ user }));
      await screen.findByText("FIVB");
      await userEvent.click(screen.getByRole("button", { name: /new organisation/i }));
    };

    it("creates with an acronym", async () => {
      mockedApi.createOrganisation.mockResolvedValue(
        organisation({ name: "New Club", acronym: "NC" }),
      );
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      await userEvent.type(screen.getByLabelText(/acronym/i), "NC");
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      await waitFor(() =>
        expect(mockedApi.createOrganisation).toHaveBeenCalledWith(
          expect.objectContaining({ name: "New Club", acronym: "NC" }),
        ),
      );
    });

    it("sends a null acronym when the field is left empty", async () => {
      mockedApi.createOrganisation.mockResolvedValue(organisation({ name: "New Club" }));
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      await waitFor(() =>
        expect(mockedApi.createOrganisation).toHaveBeenCalledWith(
          expect.objectContaining({ acronym: null }),
        ),
      );
      // One request only: no file was chosen, so no upload is attempted.
      expect(mockedApi.uploadOrganisationLogo).not.toHaveBeenCalled();
    });

    it("uploads a chosen logo after the organisation exists", async () => {
      mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 7, name: "New Club" }));
      mockedApi.uploadOrganisationLogo.mockResolvedValue(
        organisation({ id: 7, name: "New Club", logo_attached: true }),
      );
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      await userEvent.upload(screen.getByLabelText("Logo"), pngFile());
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      await waitFor(() => expect(mockedApi.createOrganisation).toHaveBeenCalled());
      // Two requests in order: the logo route needs an id, so it cannot be part of
      // the create call.
      expect(mockedApi.uploadOrganisationLogo).toHaveBeenCalledWith(7, expect.any(File));
    });

    it("refuses an unsupported logo before creating anything", async () => {
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      // Fired directly: `userEvent.upload` honours the input's `accept` filter and
      // would silently skip a text file, so the form would never see it and the
      // guard under test would never run.
      fireEvent.change(screen.getByLabelText("Logo"), {
        target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
      });
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/PNG, JPEG, GIF/i);
      // The whole point of checking first: no half-created organisation.
      expect(mockedApi.createOrganisation).not.toHaveBeenCalled();
    });

    it("refuses an oversized logo before creating anything", async () => {
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      const huge = new File(["x"], "huge.png", { type: "image/png" });
      Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
      fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [huge] } });
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/smaller than 10 MB/i);
      expect(mockedApi.createOrganisation).not.toHaveBeenCalled();
    });

    it("reports a failed logo as a partial success, not a failure", async () => {
      mockedApi.createOrganisation.mockResolvedValue(organisation({ id: 7, name: "New Club" }));
      mockedApi.uploadOrganisationLogo.mockRejectedValue(
        new Error("API Error: 422 Logo must be smaller than 10 MB"),
      );
      await openNew();

      await userEvent.type(screen.getByLabelText(/^name/i), "New Club");
      await userEvent.upload(screen.getByLabelText("Logo"), pngFile());
      await userEvent.click(screen.getByRole("button", { name: /create organisation/i }));

      // The organisation exists, so saying "nothing happened" would be a lie.
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /New Club was created, but the logo was not uploaded/i,
      );
      expect(screen.getByText("New Club")).toBeInTheDocument();
    });
  });

  // --- acronym ---------------------------------------------------------------

  it("prefers the acronym over initials taken from the name", async () => {
    // "Fédération Internationale de Volleyball" sliced to two characters is "FÉ",
    // which is worse than showing nothing.
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({
          name: "Fédération Internationale de Volleyball",
          acronym: "FIVB",
        }),
      ]),
    );
    renderPage(authValue({ user: adminUser }));

    await screen.findByText("Fédération Internationale de Volleyball");
    expect(screen.getByText("FIVB")).toBeInTheDocument();
    expect(screen.queryByText("FÉ")).not.toBeInTheDocument();
  });

  it("falls back to initials when there is no acronym", async () => {
    // The existing behaviour, kept for the organisations that have no short form.
    renderPage();

    expect(await screen.findByText("FI")).toBeInTheDocument();
  });

  it("saves a changed acronym", async () => {
    mockedApi.updateOrganisation.mockResolvedValue(organisation({ acronym: "FIVC" }));
    mockedApi.organisations.mockResolvedValue(
      paginated([organisation({ name: "Volleyball Australia", acronym: "VA", can_edit: true })]),
    );
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("Volleyball Australia");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const acronymInput = screen.getByDisplayValue("VA");
    await userEvent.clear(acronymInput);
    await userEvent.type(acronymInput, "FIVC");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(1, {
      name: "Volleyball Australia",
      acronym: "FIVC",
      description: null,
      organisation_type: "international_federation",
      parent_organisation_id: null,
    });
  });

  it("clears the acronym when the field is emptied", async () => {
    mockedApi.updateOrganisation.mockResolvedValue(organisation({ acronym: null }));
    mockedApi.organisations.mockResolvedValue(
      paginated([organisation({ acronym: "VA", can_edit: true })]),
    );
    renderPage(authValue({ user: adminUser }));
    await screen.findByText("FIVB");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByDisplayValue("VA"));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // null, not "" — otherwise a club that stops using a short form keeps showing it.
    expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "FIVB", acronym: null }),
    );
  });

  // --- per-row permissions --------------------------------------------------
  //
  // "May edit" is per organisation, not per role: a club's owner can correct their
  // own club and nothing else. The server says which in `can_edit`, and these pin
  // that the page obeys the flag rather than re-deriving it from the user's role.

  it("shows edit controls only on the rows the server says are editable", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB", can_edit: true }),
        organisation({ id: 2, name: "Sydney Beach Club", can_edit: false }),
      ]),
    );
    // A plain coach, not an admin: if the page still keyed off the role it would
    // hide both rows, and if it keyed off nothing it would show both.
    renderPage(authValue({ user: coachUser }));

    expect(await screen.findByLabelText("Upload logo for FIVB")).toBeInTheDocument();
    expect(screen.queryByLabelText("Upload logo for Sydney Beach Club")).not.toBeInTheDocument();
  });

  it("still offers create only to an admin", async () => {
    withEditableRows();
    renderPage(authValue({ user: coachUser }));

    await screen.findByText("FIVB");
    // Creating a node is a site-level act, unlike editing one.
    expect(
      screen.queryByRole("button", { name: /new organisation/i }),
    ).not.toBeInTheDocument();
  });

  // --- delete ---------------------------------------------------------------

  it("offers delete only where the server said it is possible", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([
        organisation({ id: 1, name: "FIVB", can_edit: true, can_delete: true }),
        // A real club: editable, but never deletable.
        organisation({ id: 2, name: "Sydney Beach Club", can_edit: true, can_delete: false }),
      ]),
    );
    renderPage(authValue({ user: adminUser }));

    const buttons = await screen.findAllByRole("button", { name: /^delete$/i });
    expect(buttons).toHaveLength(1);
  });

  it("deletes after confirmation and drops the row", async () => {
    mockedApi.deleteOrganisation.mockResolvedValue({ message: "Organisation deleted", id: 1 });
    mockedApi.organisations.mockResolvedValue(
      paginated([organisation({ id: 1, name: "Placeholder Club", can_edit: true, can_delete: true })]),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage(authValue({ user: adminUser }));

    await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText(/deleted/i)).toBeInTheDocument();
    expect(mockedApi.deleteOrganisation).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Placeholder Club")).not.toBeInTheDocument();
  });

  it("does nothing when the confirmation is declined", async () => {
    mockedApi.organisations.mockResolvedValue(
      paginated([organisation({ can_edit: true, can_delete: true })]),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage(authValue({ user: adminUser }));

    await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    // The point of confirming: a stray click must not destroy a record.
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedApi.deleteOrganisation).not.toHaveBeenCalled();
    expect(screen.getByText("FIVB")).toBeInTheDocument();
  });

  it("surfaces a refusal from the server instead of silently dropping the row", async () => {
    // The list can go stale: children or members may have been added since it was
    // fetched, and the server then answers 409.
    mockedApi.organisations.mockResolvedValue(
      paginated([organisation({ can_edit: true, can_delete: true })]),
    );
    mockedApi.deleteOrganisation.mockRejectedValue(
      new Error("API Error: 409 This organisation cannot be deleted"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage(authValue({ user: adminUser }));

    await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be deleted/i);
    expect(screen.getByText("FIVB")).toBeInTheDocument();
  });

  // --- the tree ---------------------------------------------------------------

  // A three-deep chain, which is what the fold control and the orphan handling are
  // actually about: FIVB → Volleyball Australia → Volleyball NSW → the club.
  const fivb = () => organisation({ id: 1, name: "FIVB" });
  const australia = () =>
    organisation({
      id: 2,
      name: "Volleyball Australia",
      parent_organisation_id: 1,
      parent_organisation: { id: 1, name: "FIVB" },
    });
  const nsw = () =>
    organisation({
      id: 3,
      name: "Volleyball NSW",
      parent_organisation_id: 2,
      parent_organisation: { id: 2, name: "Volleyball Australia" },
    });
  const club = () =>
    organisation({
      id: 4,
      name: "Sydney Beach Volleyball Club",
      parent_organisation_id: 3,
      parent_organisation: { id: 3, name: "Volleyball NSW" },
    });

  describe("folding", () => {
    it("asks for the whole hierarchy in one request", async () => {
      renderPage();
      await screen.findByText("FIVB");

      // A page boundary is meaningless for a tree: a child whose parent is in
      // another page has nothing to be drawn under.
      expect(mockedApi.organisations).toHaveBeenCalledWith("active", undefined, true);
    });

    it("folds a branch, keeping the node itself", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([fivb(), australia(), nsw(), club()]),
      );
      renderPage();
      await screen.findByText("Sydney Beach Volleyball Club");

      await userEvent.click(screen.getByRole("button", { name: "Collapse FIVB" }));

      // The node has to survive its own fold, or there is nothing left to unfold.
      expect(screen.getByText("FIVB")).toBeInTheDocument();
      expect(screen.queryByText("Volleyball Australia")).not.toBeInTheDocument();
      expect(screen.queryByText("Sydney Beach Volleyball Club")).not.toBeInTheDocument();
    });

    it("unfolds on a second press", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([fivb(), australia(), nsw(), club()]),
      );
      renderPage();
      await screen.findByText("Sydney Beach Volleyball Club");

      await userEvent.click(screen.getByRole("button", { name: "Collapse FIVB" }));
      await userEvent.click(screen.getByRole("button", { name: "Expand FIVB" }));

      expect(screen.getByText("Sydney Beach Volleyball Club")).toBeInTheDocument();
    });

    it("folds an inner branch without touching its siblings", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([
          fivb(),
          organisation({
            id: 5,
            name: "Confederação Brasileira",
            parent_organisation_id: 1,
          }),
          australia(),
          nsw(),
        ]),
      );
      renderPage();
      await screen.findByText("Volleyball NSW");

      await userEvent.click(
        screen.getByRole("button", { name: "Collapse Volleyball Australia" }),
      );

      expect(screen.queryByText("Volleyball NSW")).not.toBeInTheDocument();
      // A sibling under the same parent is unaffected.
      expect(screen.getByText("Confederação Brasileira")).toBeInTheDocument();
      expect(screen.getByText("FIVB")).toBeInTheDocument();
    });

    it("offers a fold control only where there is something to fold", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([fivb(), australia(), nsw(), club()]),
      );
      renderPage();
      await screen.findByText("Sydney Beach Volleyball Club");

      expect(
        screen.getByRole("button", { name: "Collapse FIVB" }),
      ).toBeInTheDocument();
      // The deepest node is a leaf: a control that would do nothing is not offered.
      expect(
        screen.queryByRole("button", { name: /Sydney Beach Volleyball Club/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("a child whose parent is not in the response", () => {
    // The status filter can return an active child without its archived parent.
    // Walking from the roots alone loses the child entirely, so the page would
    // silently hide rows rather than narrow them.
    it("is shown at the top level rather than dropped", async () => {
      mockedApi.organisations.mockResolvedValue(paginated([australia(), nsw()]));
      renderPage();

      expect(await screen.findByText("Volleyball Australia")).toBeInTheDocument();
      expect(screen.getByText("Volleyball NSW")).toBeInTheDocument();
    });

    it("still folds a detached node's own subtree", async () => {
      // Volleyball NSW's parent is absent, so it is shown at the top level. It
      // still has a child of its own, and folding has to work on it.
      mockedApi.organisations.mockResolvedValue(paginated([nsw(), club()]));
      renderPage();
      await screen.findByText("Sydney Beach Volleyball Club");

      await userEvent.click(
        screen.getByRole("button", { name: "Collapse Volleyball NSW" }),
      );

      expect(screen.getByText("Volleyball NSW")).toBeInTheDocument();
      expect(
        screen.queryByText("Sydney Beach Volleyball Club"),
      ).not.toBeInTheDocument();
    });
  });

  // --- moving a node ----------------------------------------------------------

  describe("the parent control", () => {
    const editableAustralia = () =>
      paginated([fivb(), organisation({ ...australia(), can_edit: true })]);

    it("is offered to an admin, pre-filled with the current parent", async () => {
      mockedApi.organisations.mockResolvedValue(editableAustralia());
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("Volleyball Australia");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));

      expect(screen.getByLabelText(/parent organisation/i)).toHaveValue("1");
    });

    it("detaches the organisation when the parent is cleared", async () => {
      mockedApi.organisations.mockResolvedValue(editableAustralia());
      mockedApi.updateOrganisation.mockResolvedValue(
        organisation({ ...australia(), parent_organisation_id: null }),
      );
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("Volleyball Australia");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      await userEvent.selectOptions(screen.getByLabelText(/parent organisation/i), "");
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

      // Sent as an explicit null: "no parent" has to be distinguishable from "leave
      // the parent alone", which is what omitting the key would mean.
      expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ parent_organisation_id: null }),
      );
    });

    it("moves the organisation under a different parent", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([
          fivb(),
          organisation({ id: 5, name: "Confederação Brasileira" }),
          organisation({ ...australia(), can_edit: true }),
        ]),
      );
      mockedApi.updateOrganisation.mockResolvedValue(organisation(australia()));
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("Volleyball Australia");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      await userEvent.selectOptions(screen.getByLabelText(/parent organisation/i), "5");
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

      expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ parent_organisation_id: 5 }),
      );
    });

    it("gives a standalone club a parent", async () => {
      // Maroubra is a root: the selector starts on "None", so the move has to be
      // made explicitly. This is the common case, not the exception.
      mockedApi.organisations.mockResolvedValue(
        paginated([
          fivb(),
          organisation({
            id: 10,
            name: "Maroubra Beach Volleyball Club",
            can_edit: true,
          }),
        ]),
      );
      mockedApi.updateOrganisation.mockResolvedValue(
        organisation({
          id: 10,
          name: "Maroubra Beach Volleyball Club",
          parent_organisation_id: 1,
          parent_organisation: { id: 1, name: "FIVB" },
        }),
      );
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("Maroubra Beach Volleyball Club");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      const select = screen.getByLabelText(/parent organisation/i);
      expect(select).toHaveValue("");
      await userEvent.selectOptions(select, "1");
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

      expect(mockedApi.updateOrganisation).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ parent_organisation_id: 1 }),
      );
      // The saved row re-nests rather than staying where it was drawn.
      expect(await screen.findByText(/under FIVB/)).toBeInTheDocument();
    });

    it("is not offered to a non-admin, and never reaches the server", async () => {
      // A club owner correcting their own record: `can_edit` is per organisation,
      // but re-parenting is a site-level act the server drops for anyone else.
      mockedApi.organisations.mockResolvedValue(
        paginated([organisation({ can_edit: true })]),
      );
      mockedApi.updateOrganisation.mockResolvedValue(
        organisation({ can_edit: true }),
      );
      renderPage(authValue({ user: coachUser }));
      await screen.findByText("FIVB");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));

      expect(screen.queryByLabelText(/parent organisation/i)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
      expect(mockedApi.updateOrganisation.mock.calls[0][1]).not.toHaveProperty(
        "parent_organisation_id",
      );
    });

    it("does not offer the organisation itself or its descendants", async () => {
      mockedApi.organisations.mockResolvedValue(
        paginated([
          organisation({ ...fivb(), can_edit: true }),
          organisation({ id: 9, name: "Top Level Club" }),
          australia(),
          nsw(),
        ]),
      );
      renderPage(authValue({ user: adminUser }));
      await screen.findByText("FIVB");

      await userEvent.click(screen.getByRole("button", { name: "Edit" }));

      const options = Array.from(
        screen.getByLabelText(/parent organisation/i).querySelectorAll("option"),
      ).map((option) => option.textContent);
      // Each of these is a cycle, which the server rejects — better not to offer a
      // choice that cannot be saved.
      expect(options).not.toContain("FIVB");
      expect(options).not.toContain("Volleyball Australia");
      expect(options).not.toContain("Volleyball NSW");
      expect(options).toContain("Top Level Club");
    });
  });
});
