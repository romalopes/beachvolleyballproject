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
  organisation_type: "international_federation",
  status: "active",
  status_label: "Active",
  parent_organisation_id: null,
  parent_organisation: null,
  child_count: 0,
  depth: 0,
  logo_url: null,
  logo_attached: false,
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

const renderPage = (auth: AuthContextValue = authValue()) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <Organisations />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

const pngFile = () => new File(["x"], "logo.png", { type: "image/png" });

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
});
