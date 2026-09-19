import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Video, VideoReference } from "../../api";
import VideoPlayer from "./VideoPlayer";

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

const withVideo = (video: Video, overrides: Partial<VideoReference> = {}): VideoReference => ({
  id: 11,
  start_seconds: 272,
  end_seconds: 378,
  title: "Platform angle",
  description: null,
  position: 0,
  can_embed: true,
  embed_url: "https://www.youtube-nocookie.com/embed/ABC123?start=272&end=378",
  external_url: video.source_url,
  video,
  ...overrides,
});

afterEach(cleanup);

describe("VideoPlayer", () => {
  it("embeds a supported provider with its generated iframe and metadata", () => {
    render(<VideoPlayer reference={withVideo(youtubeVideo)} />);

    const iframe = screen.getByTitle("Platform angle");
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/ABC123?start=272&end=378",
    );
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("04:32 – 06:18")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    const watch = screen.getByRole("link", { name: /watch on youtube/i });
    expect(watch).toHaveAttribute("href", "https://www.youtube.com/watch?v=ABC123");
    expect(watch).toHaveAttribute("target", "_blank");
    expect(watch).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("falls back to a thumbnail and watch link for a non-embeddable provider", () => {
    const withThumb = {
      ...instagramVideo,
      title: "Masterclass",
      thumbnail_url: "https://example.com/thumb.jpg",
    };
    render(
      <VideoPlayer
        reference={withVideo(withThumb, {
          can_embed: false,
          embed_url: null,
          start_seconds: null,
          end_seconds: null,
          title: null,
        })}
      />,
    );

    // No iframe is ever rendered for a non-embeddable provider.
    expect(document.querySelector("iframe")).toBeNull();
    const thumb = screen.getByAltText("Masterclass");
    expect(thumb).toHaveAttribute("src", "https://example.com/thumb.jpg");
    const watch = screen.getByRole("link", { name: /watch on instagram/i });
    expect(watch).toHaveAttribute("href", "https://www.instagram.com/p/Cabc123/");
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("shows a generic placeholder when no thumbnail is available", () => {
    render(
      <VideoPlayer
        reference={withVideo(
          { ...instagramVideo, thumbnail_url: null },
          { can_embed: false, embed_url: null },
        )}
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector(".video-placeholder")).not.toBeNull();
  });

  it("renders no unsafe iframe source for arbitrary external urls", () => {
    const external = {
      ...instagramVideo,
      provider: "external",
      provider_label: "External",
      source_url: "https://cdn.example.com/clip.mp4",
    };
    render(
      <VideoPlayer
        reference={withVideo(external, {
          can_embed: false,
          embed_url: "javascript:alert(1)",
        })}
      />,
    );

    // can_embed=false means the embed_url is ignored entirely.
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: /watch on external/i })).toHaveAttribute(
      "href",
      "https://cdn.example.com/clip.mp4",
    );
  });
});
