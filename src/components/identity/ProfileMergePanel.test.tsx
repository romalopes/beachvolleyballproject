import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Player } from "../../api";
import ProfileMergePanel from "./ProfileMergePanel";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return { ...actual, api: { ...actual.api, players: vi.fn(), mergePlayerProfile: vi.fn() } };
});

const mockedApi = vi.mocked(api, true);
const candidate: Player = {
  id: 21, person_id: null, preferred_position: null, level: null, status: "active",
  visibility: "shared", created_by: null, created_at: "2026-10-01", updated_at: "2026-10-01",
  full_name: "Alex Keep", display_name: "Alex Keep", account_status: "profile_only", person: null,
};

describe("ProfileMergePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.players.mockResolvedValue({ data: [candidate], meta: { page: 1, per_page: 100, total: 1, total_pages: 1 } });
    mockedApi.mergePlayerProfile.mockResolvedValue({ id: 3, source_profile_id: 12, canonical_profile_id: 21, reference_counts: {}, merged_at: "2026-10-06" });
  });

  it("requires an explicit target, reason, and confirmation before merging", async () => {
    const user = userEvent.setup();
    const onMerged = vi.fn();
    render(<ProfileMergePanel kind="player" sourceId={12} sourceName="Alex Duplicate" onMerged={onMerged} />);

    await user.click(screen.getByRole("button", { name: "Choose a profile to merge into" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Merge player into" }), "21");
    const mergeButton = screen.getByRole("button", { name: "Confirm merge" });
    expect(mergeButton).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Reason for profile merge" }), "Verified duplicate records");
    expect(mergeButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(mergeButton).toBeEnabled();

    await user.click(mergeButton);
    expect(mockedApi.mergePlayerProfile).toHaveBeenCalledWith(12, 21, "Verified duplicate records");
    expect(onMerged).toHaveBeenCalledWith(21);
  });
});
