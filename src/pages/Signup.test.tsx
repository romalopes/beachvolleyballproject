import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api } from "../api";
import Signup from "./Signup";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, me: vi.fn(), register: vi.fn() } };
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
    await user.type(screen.getByLabelText("Name"), "New Invitee");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => expect(mockedApi.register).toHaveBeenCalled());
    expect(window.localStorage.getItem("claimInvitationReturnPath")).toBe("/identity#claim_token=profile-token");
    expect(await screen.findByText(/account created.*verify your email/i)).toBeInTheDocument();
  });
});
