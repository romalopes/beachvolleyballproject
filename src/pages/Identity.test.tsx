import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ClaimInvitation } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import IdentityPage from "./Identity";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, playerProfileCandidates: vi.fn(), searchProfileCandidates: vi.fn(), receivedClaimInvitations: vi.fn(), acceptReceivedClaimInvitation: vi.fn(), declineReceivedClaimInvitation: vi.fn(), claimInvitations: vi.fn(), managementPlayerClaims: vi.fn(), managementClaimInvitations: vi.fn(), managementClaimables: vi.fn(), playerClaims: vi.fn(), requestPlayerClaim: vi.fn(), approvePlayerClaim: vi.fn(), rejectPlayerClaim: vi.fn(), redeemClaimInvitation: vi.fn(), people: vi.fn(), personConsolidationPreview: vi.fn(), createPlayer: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const user = { id: 7, name: "Alex Player", email_address: "alex@example.com", roles: ["player"], account_id: 9,
  player_profiles: [{ id: 12, display_name: "Alex Player", preferred_position: null, level: "advanced", status: "active" as const, visibility: "shared" as const }],
  coach_profiles: [], organisation_memberships: [], group_memberships: [] };
const userWithoutProfiles = { ...user, player_profiles: [] };
const authValue = { user, loading: false, login: vi.fn(), register: vi.fn(), resetPassword: vi.fn(), logout: vi.fn(), impersonation: { active: false, realAdmin: null }, startImpersonating: vi.fn(), stopImpersonating: vi.fn() } as unknown as AuthContextValue;
const renderPage = (entry = "/identity", currentUser: AuthContextValue["user"] = user) => render(<AuthContext.Provider value={{ ...authValue, user: currentUser } as unknown as AuthContextValue}><MemoryRouter initialEntries={[entry]}><IdentityPage /></MemoryRouter></AuthContext.Provider>);
function RouteState() {
  const location = useLocation();
  return <output data-testid="route-state">{JSON.stringify(location.state)}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.playerProfileCandidates.mockResolvedValue([]);
  mockedApi.searchProfileCandidates.mockResolvedValue({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } });
  mockedApi.receivedClaimInvitations.mockResolvedValue([]);
  mockedApi.claimInvitations.mockResolvedValue([]);
  mockedApi.managementPlayerClaims.mockResolvedValue({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } });
  mockedApi.managementClaimInvitations.mockResolvedValue({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } });
  mockedApi.managementClaimables.mockResolvedValue({ data: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } });
  mockedApi.playerClaims.mockResolvedValue([]);
});

describe("Identity", () => {
  it("keeps account and profile context distinct and explains empty suggestions", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("#9")).toBeInTheDocument();
    expect(screen.getByText("Player profiles")).toBeInTheDocument();
    expect(await screen.findByText(/no eligible profiles found/i)).toBeInTheDocument();
    expect(screen.getByText("You have no claim requests.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile management" })).not.toBeInTheDocument();
  });

  it("shows the management dashboard to a coach account", async () => {
    renderPage("/identity", { ...user, roles: ["coach"] });
    expect(await screen.findByRole("heading", { name: "Profile management" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Claims" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Invitations" })).toBeInTheDocument();
  });

  it("explains that an account without a linked profile needs a profile invitation", async () => {
    const unlinkedAccount = { ...user, account_id: null };
    renderPage("/identity", unlinkedAccount);

    expect(await screen.findByRole("heading", { name: "Claim profiles" })).toBeInTheDocument();
    expect(await screen.findByRole("note")).toHaveTextContent(/ask a coach or administrator to create an invite link/i);
    expect(screen.queryByRole("tab", { name: "Players" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Coaches" })).not.toBeInTheDocument();
  });

  it("presents matches as suggestions and lets a user request selected claims", async () => {
    mockedApi.searchProfileCandidates.mockResolvedValue({ data: [{ id: 31, player_profile_id: 31, claimable_type: "PlayerProfile", claimable_id: 31, display_name: "Alex Player", match_type: "exact_name", result_type: "candidate" }], meta: { page: 1, per_page: 20, total: 1, total_pages: 1 } });
    mockedApi.requestPlayerClaim.mockResolvedValue({ id: 3, player_profile_id: 31, person_id: 4, status: "pending", created_at: "2026-01-01", reviewed_at: null });
    renderPage();
    const checkbox = await screen.findByRole("checkbox");
    expect(screen.getByText(/Suggested match/)).toBeInTheDocument();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Review selected claims (1)" }));
    expect(screen.getByText(/must approve each request/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit claim request" }));
    await waitFor(() => expect(mockedApi.requestPlayerClaim).toHaveBeenCalledWith(31));
    expect(await screen.findByText(/still need review/)).toBeInTheDocument();
  });

  it("searches eligible profiles and paginates the results", async () => {
    mockedApi.searchProfileCandidates.mockResolvedValue({ data: [], meta: { page: 1, per_page: 20, total: 41, total_pages: 3 } });
    renderPage();
    const search = await screen.findByLabelText("Search profiles by name");
    await userEvent.type(search, "Taylor");
    await userEvent.click(screen.getAllByRole("button", { name: "Search" })[0]);
    await waitFor(() => expect(mockedApi.searchProfileCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Taylor", type: "PlayerProfile", page: 1 })));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mockedApi.searchProfileCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("lets the verified recipient accept or decline invitations and keeps their outcomes in history", async () => {
    const received = { ...invitation, invitee_email: "alex@example.com", status: "active" as const };
    mockedApi.receivedClaimInvitations.mockResolvedValue([received]);
    mockedApi.acceptReceivedClaimInvitation.mockResolvedValue({ outcome: "linked", invitation: { ...received, status: "used" }, person: { id: 4 } } as never);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mockedApi.acceptReceivedClaimInvitation).toHaveBeenCalledWith(received.id));
    expect(await screen.findByText(/profile is now linked/i)).toBeInTheDocument();
  });

  it("lets a verified recipient decline an invitation", async () => {
    mockedApi.receivedClaimInvitations.mockResolvedValue([{ ...invitation, invitee_email: "alex@example.com", status: "active" }]);
    mockedApi.declineReceivedClaimInvitation.mockResolvedValue({ ...invitation, status: "declined" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Decline" }));
    await waitFor(() => expect(mockedApi.declineReceivedClaimInvitation).toHaveBeenCalledWith(invitation.id));
    expect(await screen.findByText("Invitation declined.")).toBeInTheDocument();
  });

  it("requires a verification method before a reviewer can approve a claim", async () => {
    const admin = { ...user, roles: ["admin"] };
    mockedApi.managementPlayerClaims.mockResolvedValue({ data: [{ id: 18, player_profile_id: 31, claimable_type: "PlayerProfile", claimable_id: 31, claimant_account_id: 20, person_id: 10, status: "pending", created_at: "2026-01-01", reviewed_at: null, can_review: true }], meta: { page: 1, per_page: 20, total: 1, total_pages: 1 } });
    mockedApi.approvePlayerClaim.mockResolvedValue({ id: 18, player_profile_id: 31, person_id: 10, status: "approved", created_at: "2026-01-01", reviewed_at: "2026-01-02" });
    renderPage("/identity", admin);

    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Verification method for claim 18"), "government_id");
    expect(approve).toBeEnabled();
    await userEvent.click(approve);
    await waitFor(() => expect(mockedApi.approvePlayerClaim).toHaveBeenCalledWith(18, "government_id"));
  });

  const invitation: ClaimInvitation = {
    id: 3,
    claimable_type: "PlayerProfile",
    claimable_id: 21,
    player_profile_id: 21,
    person_id: null,
    invitee_email: null,
    emailed_at: null,
    auto_approvable: false,
    status: "used",
    expires_at: "2026-01-08",
    used_at: "2026-01-01",
    revoked_at: null,
    created_at: "2026-01-01",
  };
  it("redeems a signed-in invitation and clears its token from the URL", async () => {
    mockedApi.redeemClaimInvitation.mockResolvedValue({
      outcome: "linked",
      invitation,
      person: { id: 4, first_name: "Alex", last_name: "Player", full_name: "Alex Player", email: null, phone: null, date_of_birth: null, creation_source: "signup", account_status: "connected", player_profile_id: 21, coach_profile_id: null },
    });
    renderPage("/identity#claim_token=one-time-secret");
    expect(await screen.findByLabelText("Invitation token")).toHaveValue("one-time-secret");
    await userEvent.click(screen.getByRole("button", { name: "Redeem invitation" }));
    await waitFor(() => expect(mockedApi.redeemClaimInvitation).toHaveBeenCalledWith("one-time-secret"));
    expect(await screen.findByText(/now linked to your account/i)).toBeInTheDocument();
  });

  it("confirms immediately when the club emailed the invitation", async () => {
    mockedApi.redeemClaimInvitation.mockResolvedValue({
      outcome: "linked",
      invitation: { ...invitation, emailed_at: "2026-01-01", auto_approvable: true },
      person: { id: 4, first_name: "Alex", last_name: "Player", full_name: "Alex Player", email: "alex@example.com", phone: null, date_of_birth: null, creation_source: "signup", account_status: "connected", player_profile_id: 21, coach_profile_id: null },
    });
    renderPage("/identity#claim_token=emailed-secret");
    await screen.findByLabelText("Invitation token");
    await userEvent.click(screen.getByRole("button", { name: "Redeem invitation" }));
    expect(await screen.findByText(/now linked to your account/i)).toBeInTheDocument();
  });

  it("preserves an invitation link through the sign-in route", async () => {
    renderPage("/identity#claim_token=keep-me", null as never);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/sign in or create an account to redeem this invitation/i)).toBeInTheDocument();
  });

  it("passes an invitation link through the sign-in action for new registrants", async () => {
    render(<AuthContext.Provider value={{ ...authValue, user: null } as unknown as AuthContextValue}>
      <MemoryRouter initialEntries={["/identity#claim_token=preserve-this"]}>
        <Routes>
          <Route path="/identity" element={<IdentityPage />} />
          <Route path="/login" element={<RouteState />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>);
    await userEvent.click(await screen.findByRole("link", { name: "Sign in" }));
    expect(screen.getByTestId("route-state")).toHaveTextContent("/identity#claim_token=preserve-this");
  });

  it("continues to accept a legacy query-token invitation", async () => {
    mockedApi.redeemClaimInvitation.mockResolvedValue({
      outcome: "linked",
      invitation,
      person: { id: 4, first_name: "Alex", last_name: "Player", full_name: "Alex Player", email: null, phone: null, date_of_birth: null, creation_source: "signup", account_status: "connected", player_profile_id: 21, coach_profile_id: null },
    });
    renderPage("/identity?claim_token=legacy-token");
    expect(await screen.findByLabelText("Invitation token")).toHaveValue("legacy-token");
  });

  it("shows load errors and no longer exposes Person consolidation", async () => {
    mockedApi.playerClaims.mockRejectedValueOnce(new Error("Claims unavailable"));
    const admin = { ...user, roles: ["admin"] };
    const { unmount } = renderPage("/identity", admin);
    expect(await screen.findByRole("alert")).toHaveTextContent("Claims unavailable");
    unmount();

    mockedApi.playerClaims.mockResolvedValue([]);
    renderPage("/identity", admin);
    expect(await screen.findByText("Identity")).toBeInTheDocument();
    expect(screen.queryByText("Person consolidation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Find people")).not.toBeInTheDocument();
  });

  describe("Create Player Profile", () => {
    beforeEach(() => {
      mockedApi.createPlayer.mockReset();
      mockedApi.playerClaims.mockResolvedValue([]);
    });

    it("shows create player button when no profiles exist", async () => {
      renderPage("/identity", userWithoutProfiles);
      expect(await screen.findByText("No player profiles are linked to this account.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Player Profile" })).toBeInTheDocument();
    });

    it("opens modal when create player button is clicked", async () => {
      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      expect(await screen.findByRole("dialog", { name: "Create Player Profile" })).toBeInTheDocument();
      expect(screen.getByLabelText("Display name *")).toBeInTheDocument();
      expect(screen.getByLabelText("Preferred position")).toBeInTheDocument();
      expect(screen.getByLabelText("Level")).toBeInTheDocument();
    });

    it("closes modal when cancel is clicked", async () => {
      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      await screen.findByRole("dialog", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog", { name: "Create Player Profile" })).not.toBeInTheDocument();
    });

    it("closes modal when overlay is clicked", async () => {
      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      await screen.findByRole("dialog", { name: "Create Player Profile" });
      // Click the modal overlay (outside the modal content)
      const overlay = document.querySelector(".modal-overlay");
      if (overlay) await userEvent.click(overlay);
      expect(screen.queryByRole("dialog", { name: "Create Player Profile" })).not.toBeInTheDocument();
    });

    it("shows validation error when display name is empty", async () => {
      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      const dialog = await screen.findByRole("dialog", { name: "Create Player Profile" });
      const form = dialog.querySelector("form");
      // Click the submit button in the modal
      await userEvent.click(within(dialog).getByRole("button", { name: "Create Player Profile" }));
      // Also fire submit event on form to ensure handler is called
      if (form) {
        await act(async () => {
          fireEvent.submit(form);
        });
      }
      // Check what's in the dialog
      await waitFor(() => {});
      // Wait for the validation error to appear in the modal - use getByText since role="alert" name matching might not work
      expect(await screen.findByText("Display name is required")).toBeInTheDocument();
    });

    it("creates player profile successfully and shows notice", async () => {
      const newProfile = { id: 99, person_id: null, display_name: "New Player", email: null, preferred_position: "setter", level: "beginner", status: "active" as const, visibility: "shared" as const, created_by: null, created_at: "2026-10-08T00:00:00.000Z", updated_at: "2026-10-08T00:00:00.000Z", person: null, possible_duplicates: [] };
      mockedApi.createPlayer.mockResolvedValue(newProfile);
      mockedApi.playerClaims.mockResolvedValue([]);
      mockedApi.receivedClaimInvitations.mockResolvedValue([]);

      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      const dialog = await screen.findByRole("dialog", { name: "Create Player Profile" });

      await userEvent.type(screen.getByLabelText("Display name *"), "New Player");
      await userEvent.selectOptions(screen.getByLabelText("Preferred position"), "setter");
      await userEvent.selectOptions(screen.getByLabelText("Level"), "beginner");
      // Click the submit button in the modal (type="submit")
      await userEvent.click(within(dialog).getByRole("button", { name: "Create Player Profile" }));

      await waitFor(() => expect(mockedApi.createPlayer).toHaveBeenCalledWith({
        player_profile: {
          display_name: "New Player",
          email: null,
          preferred_position: "setter",
          level: "beginner",
          link_to_account: true,
        },
      }));

      // Wait for the modal to close
      expect(await screen.queryByRole("dialog", { name: "Create Player Profile" })).not.toBeInTheDocument();
      
      // Wait for loading to complete after reload
      await screen.findByRole("heading", { name: "Identity" });
      
      // Check for the notice
      expect(await screen.findByText("Player profile created successfully!")).toBeInTheDocument();
    });

    it("shows error when API call fails", async () => {
      mockedApi.createPlayer.mockRejectedValue(new Error("API error"));

      renderPage("/identity", userWithoutProfiles);
      await screen.findByRole("button", { name: "Create Player Profile" });
      await userEvent.click(screen.getByRole("button", { name: "Create Player Profile" }));
      const dialog = await screen.findByRole("dialog", { name: "Create Player Profile" });

      await userEvent.type(screen.getByLabelText("Display name *"), "New Player");
      // Click the submit button in the modal
      await userEvent.click(within(dialog).getByRole("button", { name: "Create Player Profile" }));

      expect(await screen.findByText("API error")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Create Player Profile" })).toBeInTheDocument();
    });
  });
});
