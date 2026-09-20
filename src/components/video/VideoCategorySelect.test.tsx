import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type VideoCategory } from "../../api";
import VideoCategorySelect from "./VideoCategorySelect";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      videoCategories: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const categories: VideoCategory[] = [
  { id: 2, name: "Attack", slug: "attack", position: 1, created_at: "", updated_at: "" },
  { id: 1, name: "Serve", slug: "serve", position: 0, created_at: "", updated_at: "" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.videoCategories.mockResolvedValue(categories);
});

afterEach(cleanup);

describe("VideoCategorySelect", () => {
  it("lists Uncategorized first, then categories ordered by position", async () => {
    render(<VideoCategorySelect value={null} onChange={vi.fn()} />);

    const select = await screen.findByRole("combobox");
    const options = within(select).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Uncategorized",
      "Serve",
      "Attack",
    ]);
  });

  it("reports the chosen category id, or null for Uncategorized", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VideoCategorySelect value={null} onChange={onChange} />);

    const select = await screen.findByRole("combobox");
    await user.selectOptions(select, "2");
    expect(onChange).toHaveBeenCalledWith(2);

    await user.selectOptions(select, "");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
