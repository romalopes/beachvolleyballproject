import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import ClaimInvitationPanel from "./ClaimInvitationPanel";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      claimInvitations: vi.fn(),
      createClaimInvitation: vi.fn(),
      revokeClaimInvitation: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.claimInvitations.mockResolvedValue([]);
});

describe("ClaimInvitationPanel", () => {
  it("lets an authorized issuer set or correct the recipient email", async () => {
    mockedApi.createClaimInvitation.mockResolvedValue({
      token: "one-time-token",
      email_delivered: true,
      invitation: {
        id: 5,
        claimable_type: "CoachProfile",
        claimable_id: 9,
        player_profile_id: null,
        person_id: null,
        invitee_email: "corrected@example.com",
        emailed_at: "2026-10-06T00:00:00Z",
        auto_approvable: true,
        status: "active",
        expires_at: "2026-10-13T00:00:00Z",
        used_at: null,
        revoked_at: null,
        created_at: "2026-10-06T00:00:00Z",
      },
    });
    render(<ClaimInvitationPanel claimableType="CoachProfile" claimableId={9} blockedReason={null} ineligibleReason={null} inviteeEmail="stale@example.com" />);

    const email = await screen.findByLabelText(/recipient email/i);
    await userEvent.clear(email);
    await userEvent.type(email, "corrected@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Create new invite link" }));

    await waitFor(() => expect(mockedApi.createClaimInvitation).toHaveBeenCalledWith("CoachProfile", 9, "corrected@example.com"));
    expect(await screen.findByLabelText("Claim invitation link")).toHaveValue("http://localhost:3000/identity#claim_token=one-time-token");
  });
});
