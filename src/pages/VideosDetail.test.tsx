import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api, type VideoSummary } from "../api";
import VideosDetail from "./VideosDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      video: vi.fn(),
      deleteVideo: vi.fn(),
      updateVideo: vi.fn(),
      videoCategories: vi.fn().mockResolvedValue([]),
      videoTags: vi.fn().mockResolvedValue([]),
      adminCreateVideoTag: vi.fn(),
    },
  };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 7, name: "Coach", email_address: "c@b.c", roles: ["coach"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const video: VideoSummary = {
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
  created_by_id: 7,
  video_category: {
    id: 10,
    name: "Serve",
    slug: "serve",
    position: 0,
    created_at: "",
    updated_at: "",
  },
  video_tags: [
    { id: 1, name: "serve", created_at: "", updated_at: "" },
    { id: 2, name: "reception", created_at: "", updated_at: "" },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/videos/1"]}>
      <Routes>
        <Route path="/videos/:id" element={<VideosDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.video.mockResolvedValue(video);
});

afterEach(cleanup);

describe("VideosDetail page", () => {
  it("renders the player, category and tags", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Masterclass");

    // Embeddable videos show a poster first; playing mounts one iframe.
    await user.click(screen.getByRole("button", { name: /play masterclass/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/ABC123",
    );
    expect(screen.getByText("Serve")).toBeInTheDocument();
    expect(screen.getByText("serve")).toBeInTheDocument();
    expect(screen.getByText("reception")).toBeInTheDocument();
    expect(screen.getByText(/used in 2/i)).toBeInTheDocument();
  });

  it("lets the owner edit and delete the video", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Masterclass");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(mockedApi.deleteVideo).toHaveBeenCalledWith(1);
  });

  it("hides the manage actions from users who are not the owner", async () => {
    mockedApi.video.mockResolvedValue({ ...video, created_by_id: 99 });
    renderPage();

    await screen.findByText("Masterclass");
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
