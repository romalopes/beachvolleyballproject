import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { api } from "../api";
import VerifyEmail from "./VerifyEmail";

vi.mock("../api", () => ({
  api: {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api, true);

const renderPage = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/verify-email?token=${token}`]}>
      <VerifyEmail />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

function RouteState() {
  const location = useLocation();
  return <output data-testid="route-state">{JSON.stringify(location.state)}</output>;
}

afterEach(cleanup);

describe("VerifyEmail page", () => {
  it("shows success after consuming a valid token", async () => {
    mockedApi.verifyEmail.mockResolvedValue({
      status: "verified",
      email_address: "a@b.c",
      name: "Bea",
    });
    renderPage("good-token");
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText(/thanks, bea/i)).toBeInTheDocument();
  });

  it("returns to the saved invitation after email verification", async () => {
    window.localStorage.setItem("claimInvitationReturnPath", "/identity#claim_token=after-verification");
    mockedApi.verifyEmail.mockResolvedValue({ status: "verified", email_address: "a@b.c", name: "Bea" });
    render(
      <MemoryRouter initialEntries={["/verify-email?token=resume-token"]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<RouteState />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("link", { name: "Go to sign in" }));
    expect(screen.getByTestId("route-state")).toHaveTextContent("/identity#claim_token=after-verification");
  });

  it("calls the endpoint exactly once per token even when remounted", async () => {
    // Regression: StrictMode double-mounts effects in dev; two requests would
    // race on the single-use token (first consumes it, second gets 422).
    mockedApi.verifyEmail.mockResolvedValue({
      status: "verified",
      email_address: "a@b.c",
      name: "Bea",
    });
    renderPage("once-token");
    await screen.findByText("Email verified");
    cleanup();
    renderPage("once-token");
    await screen.findByText("Email verified");
    expect(mockedApi.verifyEmail).toHaveBeenCalledTimes(1);
  });

  it("shows the invalid-link state with a resend option on failure", async () => {
    mockedApi.verifyEmail.mockRejectedValue(new Error("422"));
    renderPage("bad-token");
    expect(
      await screen.findByText(/invalid verification link/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });
});
