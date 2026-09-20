import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type VideoTag } from "../../api";
import VideoTagPicker from "./VideoTagPicker";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      videoTags: vi.fn(),
      adminCreateVideoTag: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const tags: VideoTag[] = [
  { id: 1, name: "serve", created_at: "", updated_at: "" },
  { id: 2, name: "reception", created_at: "", updated_at: "" },
];

const renderPicker = (props: Partial<Parameters<typeof VideoTagPicker>[0]> = {}) =>
  render(<VideoTagPicker value={[]} onChange={vi.fn()} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.videoTags.mockResolvedValue(tags);
});

afterEach(cleanup);

describe("VideoTagPicker", () => {
  it("adds a tag on click and removes it from the chips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<VideoTagPicker value={[]} onChange={onChange} />);

    await user.click(await screen.findByRole("button", { name: /add tag serve/i }));
    expect(onChange).toHaveBeenCalledWith([1]);

    rerender(<VideoTagPicker value={[1]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /remove tag serve/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("filters the available tags when searchable", async () => {
    const user = userEvent.setup();
    renderPicker({ searchable: true });

    await screen.findByRole("button", { name: /add tag serve/i });
    await user.type(screen.getByLabelText(/filter tags/i), "rec");

    expect(screen.getByRole("button", { name: /add tag reception/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add tag serve/i })).toBeNull();
  });

  it("lets admins create a missing tag inline and selects it", async () => {
    mockedApi.adminCreateVideoTag.mockResolvedValue({
      id: 3,
      name: "block",
      created_at: "",
      updated_at: "",
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ searchable: true, allowCreate: true, onChange });

    await screen.findByRole("button", { name: /add tag serve/i });
    await user.type(screen.getByLabelText(/filter tags/i), "block");
    await user.click(screen.getByRole("button", { name: /create tag/i }));

    expect(mockedApi.adminCreateVideoTag).toHaveBeenCalledWith({ name: "block" });
    expect(onChange).toHaveBeenCalledWith([3]);
  });

  it("hides the create affordance from non-admins", async () => {
    const user = userEvent.setup();
    renderPicker({ searchable: true, allowCreate: false });

    await screen.findByRole("button", { name: /add tag serve/i });
    await user.type(screen.getByLabelText(/filter tags/i), "nomatch");

    expect(screen.queryByRole("button", { name: /create tag/i })).toBeNull();
    expect(screen.getByText(/no tags found/i)).toBeInTheDocument();
  });
});
