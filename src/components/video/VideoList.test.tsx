import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Video, type VideoReference } from "../../api";
import VideoList from "./VideoList";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      removeVideoReference: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const youtubeVideo: Video = {
  id: 1,
  title: "Masterclass",
  provider: "youtube",
  source_url: "https://www.youtube.com/watch?v=ABC123",
  thumbnail_url: "https://i.ytimg.com/vi/ABC123/hqdefault.jpg",
  duration_seconds: 900,
  provider_label: "YouTube",
};

const instagramVideo: Video = {
  id: 2,
  title: null,
  provider: "instagram",
  source_url: "https://www.instagram.com/p/Cabc123/",
  thumbnail_url: null,
  duration_seconds: null,
  provider_label: "Instagram",
};

const reference = (
  id: number,
  video: Video,
  overrides: Partial<VideoReference> = {},
): VideoReference => ({
  id,
  start_seconds: 272,
  end_seconds: 378,
  title: `Clip ${id}`,
  description: null,
  position: id - 10,
  can_embed: video.provider === "youtube",
  embed_url: video.provider === "youtube" ? `https://www.youtube-nocookie.com/embed/${video.id}` : null,
  external_url: video.source_url,
  video,
  ...overrides,
});

const youtubeRef = reference(11, youtubeVideo);
const instagramRef = reference(12, instagramVideo);

const renderList = (
  references: VideoReference[],
  props: Partial<Parameters<typeof VideoList>[0]> = {},
) =>
  render(
    <VideoList
      references={references}
      target="drills"
      targetId={7}
      canManage
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.removeVideoReference.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("VideoList", () => {
  it("shows an empty state without videos", () => {
    renderList([]);
    expect(screen.getByText("No videos yet")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("shows the Add button for a manager when the list is empty and opens the form", async () => {
    const user = userEvent.setup();
    renderList([]);

    expect(screen.getByText("No videos yet")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: /add video/i });
    await user.click(add);
    // The create form replaces the empty state (URL / library mode toggle).
    expect(screen.getByRole("radiogroup", { name: /video source/i })).toBeInTheDocument();
    expect(screen.queryByText("No videos yet")).toBeNull();
  });

  it("hides the Add button for visitors when the list is empty", () => {
    renderList([], { canManage: false });
    expect(screen.getByText("No videos yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add video/i })).toBeNull();
  });

  it("renders the single video's embedded player", () => {
    renderList([youtubeRef]);
    expect(screen.getByTitle("Clip 11")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/1",
    );
    expect(screen.queryByText(/add video/i)).not.toBeNull();
  });

  it("loads one player at a time and switches on selection", async () => {
    const user = userEvent.setup();
    renderList([youtubeRef, instagramRef]);

    // Only one iframe for two videos.
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    // The edit/remove buttons also mention the clip, so pick the selector row.
    await user.click(screen.getAllByRole("button", { name: /Clip 12/ })[0]);

    // Instagram cannot embed: the fallback appears instead of an iframe.
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: /watch on instagram/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/p/Cabc123/");
  });

  it("orders the list by position and numbers the rows distinctly", () => {
    const late = reference(13, youtubeVideo, { position: 5, title: "Last clip" });
    renderList([late, youtubeRef, instagramRef]);
    const titles = Array.from(
      document.querySelectorAll(".video-list-item-title"),
    ).map((el) => el.textContent);
    expect(titles).toEqual(["1. Clip 11", "2. Clip 12", "3. Last clip"]);
  });

  it("lets a manager edit/remove a single video", async () => {
    const user = userEvent.setup();
    renderList([youtubeRef]);
    expect(
      screen.getByRole("button", { name: "Remove Clip 11" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Clip 11" }));
    expect(mockedApi.removeVideoReference).toHaveBeenCalledWith("drills", 7, 11);
  });

  it("shows a single video without a redundant list for visitors", () => {
    renderList([youtubeRef], { canManage: false });
    expect(screen.getByTitle("Clip 11")).toBeInTheDocument();
    expect(document.querySelector(".video-list-selector")).toBeNull();
  });

  it("deletes a reference through the api and notifies the page", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderList([youtubeRef, instagramRef], { onChanged });

    await user.click(screen.getByRole("button", { name: "Remove Clip 12" }));

    expect(mockedApi.removeVideoReference).toHaveBeenCalledWith("drills", 7, 12);
    expect(onChanged).toHaveBeenCalled();
  });

  it("hides management controls for visitors", () => {
    renderList([youtubeRef], { canManage: false });
    expect(screen.queryByRole("button", { name: /add video/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit clip 11/i })).toBeNull();
  });
});
