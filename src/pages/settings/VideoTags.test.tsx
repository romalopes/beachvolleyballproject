import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api, type VideoTag } from "../../api";
import VideoTags from "./VideoTags";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      adminVideoTags: vi.fn(),
      adminCreateVideoTag: vi.fn(),
      adminUpdateVideoTag: vi.fn(),
      adminDestroyVideoTag: vi.fn(),
    },
  };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Admin", email_address: "a@b.c", roles: ["admin"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const tags: VideoTag[] = [
  { id: 1, name: "serve", video_count: 4, created_at: "", updated_at: "" },
  { id: 2, name: "reception", video_count: 0, created_at: "", updated_at: "" },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <VideoTags />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminVideoTags.mockResolvedValue(tags);
});

afterEach(cleanup);

describe("VideoTags settings page", () => {
  it("lists tags with their usage count", async () => {
    renderPage();

    expect(await screen.findByText("Serve")).toBeInTheDocument();
    expect(screen.getByText("Reception")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("creates a tag from the new-tag form", async () => {
    mockedApi.adminCreateVideoTag.mockResolvedValue(tags[0]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /new tag/i }));
    await user.type(screen.getByLabelText(/^name/i), "block");
    await user.click(screen.getByRole("button", { name: /create tag/i }));

    expect(mockedApi.adminCreateVideoTag).toHaveBeenCalledWith({ name: "block" });
  });

  it("edits a tag inline", async () => {
    mockedApi.adminUpdateVideoTag.mockResolvedValue(tags[0]);
    const user = userEvent.setup();
    renderPage();

    const serveRow = (await screen.findByText("Serve")).closest("tr");
    await user.click(within(serveRow as HTMLElement).getByRole("button", { name: /edit/i }));
    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "serving");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mockedApi.adminUpdateVideoTag).toHaveBeenCalledWith(1, {
      name: "serving",
    });
  });

  it("deletes a tag after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    const serveRow = (await screen.findByText("Serve")).closest("tr");
    await user.click(within(serveRow as HTMLElement).getByRole("button", { name: /delete/i }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(mockedApi.adminDestroyVideoTag).toHaveBeenCalledWith(1);
  });

  it("filters tags by name", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Serve");
    await user.type(screen.getByLabelText(/filter tags/i), "rec");

    expect(screen.queryByText("Serve")).toBeNull();
    expect(screen.getByText("Reception")).toBeInTheDocument();
  });
});
