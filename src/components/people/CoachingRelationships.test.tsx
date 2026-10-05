import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import CoachingRelationships from "./CoachingRelationships";

describe("CoachingRelationships", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lets a coach choose which of their profiles to record for a player", async () => {
    vi.spyOn(api, "playerCoaches").mockResolvedValue([]);
    const create = vi.spyOn(api, "createPlayerCoach").mockResolvedValue({
      id: 19,
      player_profile_id: 12,
      coach_profile_id: 8,
      start_date: "2026-10-04",
      end_date: null,
      current: true,
      duration_in_days: null,
      coach_name: "Sam Coach",
      player_name: "Player",
      created_at: "2026-10-04T00:00:00Z",
      updated_at: "2026-10-04T00:00:00Z",
    });
    const user = userEvent.setup();

    render(
      <CoachingRelationships
        side="player"
        profileId={12}
        canManage
        viewerCoachProfileId={7}
        viewerCoachProfiles={[
          { id: 7, coaching_level: "State", qualifications: null, status: "active" },
          { id: 8, coaching_level: "Beach", qualifications: "Level 2", status: "active" },
        ]}
        isAdmin={false}
      />,
    );

    const selector = await screen.findByRole("combobox", { name: "Coach profile" });
    await user.selectOptions(selector, "8");
    await user.click(screen.getByRole("button", { name: "Add coach" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        player_profile_id: 12,
        coach_profile_id: 8,
        start_date: expect.any(String),
      }),
    );
  });
});
