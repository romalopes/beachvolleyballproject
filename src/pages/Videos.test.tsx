import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type VideoSummary } from "../api";
import Videos from "./Videos";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      videos: vi.fn(),
      videoCategories: vi.fn().mockResolvedValue([]),
      createVideo: vi.fn(),
      videoTags: vi.fn().mockResolvedValue([]),
      adminCreateVideoTag: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const serving = {
  id: 10,
  name: "Serving",
  slug: "serving",
  description: null,
  position: 0,
  created_at: "",
  updated_at: "",
};

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
  video_category: serving,
  video_tags: [],
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
  video_category: null,
  video_tags: [],
};

const renderVideos = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Videos />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(null);
  mockedApi.videos.mockResolvedValue([youtubeVideo, instagramVideo]);
  mockedApi.videoCategories.mockResolvedValue([serving]);
});

afterEach(cleanup);

describe("Videos library page", () => {
  it("groups videos under their category heading, uncategorized last", async () => {
    renderVideos();

    const servingSection = await screen.findByRole("region", {
      name: /^serving/i,
    });
    expect(within(servingSection).getByText("Masterclass")).toBeInTheDocument();
    expect(within(servingSection).queryByText("Reel")).toBeNull();

    const uncategorized = screen.getByRole("region", {
      name: /^uncategorized/i,
    });
    expect(within(uncategorized).getByText("Reel")).toBeInTheDocument();
  });

  it("omits categories that have no videos", async () => {
    mockedApi.videoCategories.mockResolvedValue([
      serving,
      { ...serving, id: 11, name: "Blocking", slug: "blocking", position: 1 },
    ]);
    renderVideos();

    await screen.findByText("Masterclass");
    expect(screen.queryByText("Blocking")).toBeNull();
  });

  it("links each card to its detail page", async () => {
    renderVideos();
    const link = await screen.findByRole("link", { name: /masterclass/i });
    expect(link).toHaveAttribute("href", "/videos/1");
  });

  it("renders embeddable and non-embeddable providers side by side", async () => {
    renderVideos();

    // Cards always link to the detail page; playback happens there.
    const cardLink = await screen.findByRole("link", { name: /masterclass/i });
    expect(cardLink).toHaveAttribute("href", "/videos/1");

    // The library page never mounts iframes.
    expect(document.querySelector("iframe")).toBeNull();
  });
});
