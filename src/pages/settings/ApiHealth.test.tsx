import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../auth/AuthContext";
import { api } from "../../api";
import { APP_VERSION } from "../../constants/versions";
import ApiHealth from "./ApiHealth";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    API_BASE_URL: "/api/v1",
    api: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  };
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const adminUser = {
  id: 2,
  name: "Admin",
  email_address: "admin@example.com",
  roles: ["admin", "coach"],
};

const playerUser = {
  id: 1,
  name: "Player",
  email_address: "player@example.com",
  roles: ["player"],
};

// Default: every endpoint the runner can hit returns a healthy payload.
// `backendVersion` simulates what the Rails /health/detailed endpoint reports,
// so version display can be tested independently of APP_VERSION.
function stubHealthyApi(backendVersion: string = "0.0.21") {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
    if (url.endsWith("/health/detailed"))
      return jsonResponse({
        status: "ok",
        service: "bvb-api",
        database: "ok",
        environment: "test",
        version: backendVersion,
        timestamp: new Date().toISOString(),
        database_details: { adapter: "postgresql", pool: 5 },
        server: { rails_version: "8.1.3", pid: 1 },
        endpoint: { path: "/api/v1/health/detailed" },
        counts: { categories: 2, drills: 1 },
      });
    if (url.endsWith("/me")) {
      return jsonResponse(adminUser);
    }
    if (url.endsWith("/account"))
      return jsonResponse({ id: 1, first_name: "Bea", address: {} });
    if (url.endsWith("/categories"))
      return jsonResponse([{ id: 1, name: "Serving", slug: "serving" }]);
    if (url.endsWith("/skills"))
      return jsonResponse([
        { id: 1, title: "Serve", slug: "serve", category_id: 1 },
      ]);
    if (url.endsWith("/drills"))
      return jsonResponse([{ id: 1, title: "D1", slug: "d1", skills: [] }]);
    if (url.endsWith("/drill_skills"))
      return jsonResponse([{ id: 1, drill_id: 1, skill_id: 1 }]);
    if (url.endsWith("/training_sessions"))
      return jsonResponse([{ id: 1, drill_id: 1, scheduled_at: "2026-01-01" }]);
    if (url.endsWith("/media_assets"))
      return jsonResponse([
        { id: 1, drill_id: 1, title: "Clip", video_url: "https://x/y.mp4" },
      ]);
    return jsonResponse({}, 404);
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ApiHealth />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("ApiHealth page", () => {
  it("blocks non-admin users", async () => {
    vi.mocked(api.me).mockResolvedValue(playerUser);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(
          "You do not have permission to view API health diagnostics.",
        ),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Run All Checks" }),
    ).not.toBeInTheDocument();
  });

  it("renders the check catalogue for admins", async () => {
    vi.mocked(api.me).mockResolvedValue(adminUser);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run All Checks" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Public Liveness Check")).toBeInTheDocument();
    expect(
      screen.getByText("Unauthenticated /me Rejection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Categories List")).toBeInTheDocument();
    expect(
      screen.getByText("Drills List (definition excluded)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Write Sandbox")).toBeInTheDocument();
    // Infrastructure panel only appears after the detailed check runs.
    expect(screen.queryByText("Infrastructure")).not.toBeInTheDocument();
  });

  it("runs a single check and shows PASS with latency", async () => {
    vi.mocked(api.me).mockResolvedValue(adminUser);
    vi.stubGlobal("fetch", stubHealthyApi());
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run All Checks" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getAllByRole("button", { name: "Test" })[0]);
    await waitFor(() =>
      expect(screen.getAllByText("PASS").length).toBeGreaterThan(0),
    );
    // Running the detailed check populates the Infrastructure panel.
    await user.click(screen.getAllByRole("button", { name: "Test" })[1]);
    await waitFor(() =>
      expect(screen.getByText("Infrastructure")).toBeInTheDocument(),
    );
    expect(screen.getByText("Record counts")).toBeInTheDocument();
  });
});

describe("ApiHealth version display", () => {
  it("shows a version match when the backend reports APP_VERSION (0.0.21)", async () => {
    expect(APP_VERSION).toBe("0.0.21");
    vi.mocked(api.me).mockResolvedValue(adminUser);
    vi.stubGlobal("fetch", stubHealthyApi("0.0.21"));
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Run All Checks" }),
    );

    // The displayed version comes from the backend API response.
    expect(
      await screen.findByText("✓ Version match: backend 0.0.21"),
    ).toBeInTheDocument();
  });

  it("shows backend 0.0.19 from the API even though the React version is 0.0.21", async () => {
    vi.mocked(api.me).mockResolvedValue(adminUser);
    vi.stubGlobal("fetch", stubHealthyApi("0.0.20"));
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Run All Checks" }),
    );

    expect(
      await screen.findByText(
        `⚠ Version mismatch: backend reports 0.0.20 but frontend expects ${APP_VERSION}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/✓ Version match/)).not.toBeInTheDocument();
  });
});
