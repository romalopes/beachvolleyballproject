import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import IdentityPage from "./Identity";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, playerProfileCandidates: vi.fn(), playerClaims: vi.fn(), requestPlayerClaim: vi.fn(), redeemPlayerClaimInvitation: vi.fn(), people: vi.fn(), personConsolidationPreview: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const user = { id: 7, name: "Alex Player", email_address: "alex@example.com", roles: ["player"], person_id: 4, account_id: 9,
  player_profiles: [{ id: 12, display_name: "Alex Player", preferred_position: null, level: "advanced", status: "active" as const, visibility: "shared" as const }],
  coach_profiles: [], organisation_memberships: [], group_memberships: [] };
const authValue = { user, loading: false, login: vi.fn(), register: vi.fn(), resetPassword: vi.fn(), logout: vi.fn(), impersonation: { active: false, realAdmin: null }, startImpersonating: vi.fn(), stopImpersonating: vi.fn() } as unknown as AuthContextValue;
const renderPage = (entry = "/identity", currentUser = user) => render(<AuthContext.Provider value={{ ...authValue, user: currentUser } as unknown as AuthContextValue}><MemoryRouter initialEntries={[entry]}><IdentityPage /></MemoryRouter></AuthContext.Provider>);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.playerProfileCandidates.mockResolvedValue([]);
  mockedApi.playerClaims.mockResolvedValue([]);
});

describe("Identity", () => {
  it("keeps account and profile context distinct and explains empty suggestions", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("#9")).toBeInTheDocument();
    expect(screen.getByText("Player profiles")).toBeInTheDocument();
    expect(await screen.findByText("No profile suggestions are available.")).toBeInTheDocument();
    expect(screen.getByText("You have no claim requests.")).toBeInTheDocument();
  });

  it("presents matches as suggestions and lets a user request selected claims", async () => {
    mockedApi.playerProfileCandidates.mockResolvedValue([{ id: 31, player_profile_id: 31, display_name: "Alex Player", match_type: "exact_name", result_type: "candidate" }]);
    mockedApi.requestPlayerClaim.mockResolvedValue({ id: 3, player_profile_id: 31, person_id: 4, status: "pending", created_at: "2026-01-01", reviewed_at: null });
    renderPage();
    const checkbox = await screen.findByRole("checkbox");
    expect(screen.getByText(/Suggested match/)).toBeInTheDocument();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Request selected claims (1)" }));
    await waitFor(() => expect(mockedApi.requestPlayerClaim).toHaveBeenCalledWith(31));
    expect(await screen.findByText(/still need review/)).toBeInTheDocument();
  });

  it("redeems a signed-in invitation and clears its token from the URL", async () => {
    mockedApi.redeemPlayerClaimInvitation.mockResolvedValue({ claim: { id: 8, player_profile_id: 21, person_id: 4, status: "pending", created_at: "2026-01-01", reviewed_at: null } });
    renderPage("/identity#claim_token=one-time-secret");
    expect(await screen.findByLabelText("Invitation token")).toHaveValue("one-time-secret");
    await userEvent.click(screen.getByRole("button", { name: "Submit claim request" }));
    await waitFor(() => expect(mockedApi.redeemPlayerClaimInvitation).toHaveBeenCalledWith("one-time-secret"));
    expect(await screen.findByText(/Claim request 8 was submitted/)).toBeInTheDocument();
  });

  it("preserves an invitation link through the sign-in route", async () => {
    renderPage("/identity#claim_token=keep-me", null as never);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/redeem a player claim invitation/i)).toBeInTheDocument();
  });

  it("continues to accept a legacy query-token invitation", async () => {
    mockedApi.redeemPlayerClaimInvitation.mockResolvedValue({ claim: { id: 10, player_profile_id: 22, person_id: 4, status: "pending", created_at: "2026-01-01", reviewed_at: null } });
    renderPage("/identity?claim_token=legacy-token");
    expect(await screen.findByLabelText("Invitation token")).toHaveValue("legacy-token");
  });

  it("shows load errors and blocks consolidation on an account conflict", async () => {
    mockedApi.playerClaims.mockRejectedValueOnce(new Error("Claims unavailable"));
    const admin = { ...user, roles: ["admin"] };
    const { unmount } = renderPage("/identity", admin);
    expect(await screen.findByRole("alert")).toHaveTextContent("Claims unavailable");
    unmount();

    mockedApi.playerClaims.mockResolvedValue([]);
    mockedApi.people.mockResolvedValue([
      { id: 1, first_name: "Alex", last_name: "Source", full_name: "Alex Source", email: null, phone: null, date_of_birth: null, creation_source: "system", account_status: "profile_only", player_profile_id: null, coach_profile_id: null },
      { id: 2, first_name: "Alex", last_name: "Keep", full_name: "Alex Keep", email: null, phone: null, date_of_birth: null, creation_source: "system", account_status: "profile_only", player_profile_id: null, coach_profile_id: null },
    ]);
    mockedApi.personConsolidationPreview.mockResolvedValue({ source_person: { id: 1, full_name: "Alex Source", status: "active" }, canonical_person: { id: 2, full_name: "Alex Keep", status: "active" }, conflicts: [{ type: "account_conflict", source_record_id: 8, canonical_record_id: 9 }], ready: false, records_to_reassign: {} });
    renderPage("/identity", admin);
    await userEvent.type(await screen.findByLabelText("Find people"), "Alex");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.selectOptions(screen.getByLabelText("Source record"), "1");
    await userEvent.selectOptions(screen.getByLabelText("Keep this Person"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText(/account conflict blocks this action/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm consolidation" })).toBeDisabled();
  });
});
