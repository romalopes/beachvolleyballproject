import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { api, type VideoSummary } from "../api";
import Videos from "./Videos";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      videos: vi.fn(),
      createVideo: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const youtubeVideo: VideoSummary = {
  id: 1,
  title: "Masterclass",
  provider: "youtube",
  source_url: "https://www.youtube.com/watch?v=ABC123",
  thumbnail_url: null,
  duration_seconds: 900,
  provider_label: "YouTube",
  can_embed: true,
  embed_url: "https://www.youtube-nocookie.com/embed/ABC123",
  external_url: "https://www.youtube.com/watch?v=ABC123",
  reference_count: 2,
};

const instagramVideo: VideoSummary = {
  id: 2,
  title: "Reel",
  provider: "instagram",
  source_url: "https://www.instagram.com/p/Cabc123/",
  thumbnail_url: null,
  duration_seconds: null,
  provider_label: "Instagram",
  can_embed: false,
  embed_url: null,
  external_url: "https://www.instagram.com/p/Cabc123/",
  reference_count: 0,
};

const renderVideos = () =>
  render(
    <AuthProvider>
      <Videos />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(null);
  mockedApi.videos.mockResolvedValue([youtubeVideo, instagramVideo]);
});

afterEach(cleanup);

describe("Videos library page", () => {
  it("plays an embeddable video inline, one at a time", async () => {
    const user = userEvent.setup();
    renderVideos();

    await screen.findByText("Masterclass");
    expect(document.querySelector("iframe")).toBeNull();

    await user.click(screen.getByRole("button", { name: /play masterclass/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/ABC123",
    );

    // Only one iframe even though other cards exist.
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("never embeds a non-embeddable provider", async () => {
    renderVideos();
    await screen.findByText("Reel");
    expect(screen.queryByRole("button", { name: /play reel/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /watch on instagram/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/p/Cabc123/");
  });
});
