import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { api } from "../api";
import Login from "./Login";

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

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(null);
});

describe("Login page", () => {
  it("renders the sign-in form", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Sign in" })
      ).toBeInTheDocument()
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();
    expect(screen.getByText("Create an account")).toBeInTheDocument();
  });

  it("submits the credentials via the auth context", async () => {
    const user = userEvent.setup();
    mockedApi.login.mockResolvedValue({
      id: 1,
      name: "Bea",
      email_address: "bea@example.com",
      roles: ["player"],
    });
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "bea@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(mockedApi.login).toHaveBeenCalledWith(
        "bea@example.com",
        "password123"
      )
    );
  });

  it("shows a loading state while submitting", async () => {
    const user = userEvent.setup();
    mockedApi.login.mockImplementation(
      () => new Promise(() => {}) as Promise<never>
    );
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "bea@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Signing in..." })
      ).toBeInTheDocument()
    );
  });

  it("displays the backend error when sign-in fails", async () => {
    const user = userEvent.setup();
    mockedApi.login.mockRejectedValue(
      new Error("Invalid email address or password.")
    );
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "bea@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByText("Invalid email address or password.")
      ).toBeInTheDocument()
    );
    // Still on the form, able to retry.
    expect(
      screen.getByRole("button", { name: "Sign in" })
    ).toBeInTheDocument();
  });
});
