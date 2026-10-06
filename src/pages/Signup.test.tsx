import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api } from "../api";
import Signup from "./Signup";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, me: vi.fn(), register: vi.fn(), resendVerification: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedApi.me.mockResolvedValue(null);
});

describe("Signup", () => {
  it("keeps a claim invitation path while the new account waits for email verification", async () => {
    mockedApi.register.mockResolvedValue({
      id: 91,
      name: "New Invitee",
      email_address: "new@example.com",
      roles: ["player"],
      status: "pending_verification",
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signup", state: { from: "/identity#claim_token=profile-token" } }]}>
        <AuthProvider><Signup /></AuthProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("First name"), "New");
    await user.type(screen.getByLabelText("Last name"), "Invitee");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockedApi.register).toHaveBeenCalled());
    expect(window.localStorage.getItem("claimInvitationReturnPath")).toBe("/identity#claim_token=profile-token");
    expect(await screen.findByRole("heading", { name: /one click away/i })).toBeInTheDocument();
    expect(screen.getByText(/we just need to know/i)).toBeInTheDocument();
    // Registration fields are hidden once the account is created.
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sign up$/i })).not.toBeInTheDocument();
    // Verification guidance is shown instead.
    expect(screen.getByText(/open your inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/locate our verification email/i)).toBeInTheDocument();
    expect(screen.getByText(/click the verification link/i)).toBeInTheDocument();
    expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument();
  });

  it("resends the verification email from the pending-verification panel", async () => {
    mockedApi.register.mockResolvedValue({
      id: 92,
      name: "Second User",
      email_address: "second@example.com",
      roles: ["player"],
      status: "pending_verification",
    });
    mockedApi.resendVerification.mockResolvedValue({ status: "ok" });
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <AuthProvider><Signup /></AuthProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("First name"), "Second");
    await user.type(screen.getByLabelText("Last name"), "User");
    await user.type(screen.getByLabelText("Email"), "second@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await screen.findByRole("heading", { name: /one click away/i });
    await user.click(screen.getByRole("button", { name: /resend verification email/i }));
    await waitFor(() => expect(mockedApi.resendVerification).toHaveBeenCalledWith("second@example.com"));
    expect(await screen.findByText(/a new verification email has been sent/i)).toBeInTheDocument();
  });
});
