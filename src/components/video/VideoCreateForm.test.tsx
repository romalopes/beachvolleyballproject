import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import VideoCreateForm from "./VideoCreateForm";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      createVideo: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const renderCreateForm = (props: Partial<Parameters<typeof VideoCreateForm>[0]> = {}) =>
  render(<VideoCreateForm onSaved={vi.fn()} onCancel={vi.fn()} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createVideo.mockResolvedValue({
    id: 40,
    title: "Library clip",
    provider: "youtube",
    source_url: "https://www.youtube.com/watch?v=Lib1",
    thumbnail_url: null,
    duration_seconds: null,
    provider_label: "YouTube",
    can_embed: true,
    embed_url: "https://www.youtube-nocookie.com/embed/Lib1",
    external_url: "https://www.youtube.com/watch?v=Lib1",
    reference_count: 0,
  });
});

afterEach(cleanup);

describe("VideoCreateForm — standalone library videos", () => {
  it("creates a standalone video from a url", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderCreateForm({ onSaved });

    await user.type(screen.getByLabelText(/video url/i), "https://youtu.be/Lib1");
    await user.type(screen.getByLabelText(/^Title$/i), "Library clip");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(mockedApi.createVideo).toHaveBeenCalledWith({
      source_url: "https://youtu.be/Lib1",
      title: "Library clip",
    });
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("rejects an invalid url without calling the api", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText(/video url/i), "not a url");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(
      await screen.findByText(/Enter a valid video URL/i),
    ).toBeInTheDocument();
    expect(mockedApi.createVideo).not.toHaveBeenCalled();
  });
});
