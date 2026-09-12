import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading…</div>;
  return <div>{user ? `signed in as ${user.name}` : "signed out"}</div>;
}

const userFixture = {
  id: 1,
  name: "Bea Volley",
  email_address: "bea@example.com",
  roles: ["player"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("restores the session from the backend on mount", async () => {
    mockedApi.me.mockResolvedValue(userFixture);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("signed in as Bea Volley")).toBeInTheDocument()
    );
    expect(mockedApi.me).toHaveBeenCalledOnce();
  });

  it("starts signed out when session restore fails", async () => {
    mockedApi.me.mockRejectedValue(new Error("API Error: 401"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText("signed out")).toBeInTheDocument()
    );
  });

  it("login delegates to the API and publishes the user", async () => {
    mockedApi.me.mockResolvedValue(null);
    mockedApi.login.mockResolvedValue(userFixture);
    const user = userEvent.setup();

    function LoginProbe() {
      const { user: current, login } = useAuth();
      return (
        <button onClick={() => login("bea@example.com", "password123")}>
          {current ? current.name : "log me in"}
        </button>
      );
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );
    await user.click(screen.getByRole("button", { name: "log me in" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bea Volley" })).toBeInTheDocument()
    );
    expect(mockedApi.login).toHaveBeenCalledWith(
      "bea@example.com",
      "password123"
    );
  });

  it("logout clears the published user", async () => {
    mockedApi.me.mockResolvedValue(userFixture);
    mockedApi.logout.mockResolvedValue(undefined);
    const user = userEvent.setup();

    function LogoutProbe() {
      const { user: current, logout } = useAuth();
      return (
        <button onClick={() => logout()}>
          {current ? `sign out ${current.name}` : "signed out"}
        </button>
      );
    }

    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "sign out Bea Volley" })
      ).toBeInTheDocument()
    );
    await user.click(
      screen.getByRole("button", { name: "sign out Bea Volley" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "signed out" })
      ).toBeInTheDocument()
    );
    expect(mockedApi.logout).toHaveBeenCalledOnce();
  });
});
