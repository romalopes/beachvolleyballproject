import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Organisation } from "../api";
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
  mockedApi.organisations.mockResolvedValue(paginated([organisation({ can_edit: true })]));

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
});
