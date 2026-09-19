import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type VideoReference } from "../../api";
import VideoForm from "./VideoForm";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      createVideoReference: vi.fn(),
      updateVideoReference: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const saved: VideoReference = {
  id: 21,
  start_seconds: 272,
  end_seconds: 378,
  title: "Saved clip",
  description: null,
  position: 1,
  can_embed: true,
  embed_url: null,
  external_url: "https://www.youtube.com/watch?v=ABC123",
  video: {
    id: 1,
    title: null,
    provider: "youtube",
    source_url: "https://www.youtube.com/watch?v=ABC123",
    thumbnail_url: null,
    duration_seconds: null,
    provider_label: "YouTube",
  },
};

const renderForm = (props: Partial<Parameters<typeof VideoForm>[0]> = {}) =>
  render(
    <VideoForm
      target="drills"
      targetId={7}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createVideoReference.mockResolvedValue(saved);
  mockedApi.updateVideoReference.mockResolvedValue(saved);
});

afterEach(cleanup);

describe("VideoForm", () => {
  it("detects and displays the provider as the url is typed", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://www.instagram.com/p/Cabc123/",
    );

    // The provider line mixes text and a <strong>; match on its class hook.
    expect(document.querySelector(".video-form-provider")?.textContent).toContain(
      "Detected provider: Instagram",
    );
    expect(document.querySelector(".video-form-provider")?.textContent).toContain(
      "Watch link instead of a player",
    );
  });

  it("creates a reference with timestamps converted to integer seconds", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderForm({ onSaved });

    await user.type(screen.getByLabelText(/video url/i), "https://youtu.be/ABC123");
    await user.type(screen.getByLabelText(/^Title$/i), "Serve receive");
    await user.type(screen.getByLabelText(/^Start$/i), "04:32");
    await user.type(screen.getByLabelText(/^End$/i), "06:18");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(mockedApi.createVideoReference).toHaveBeenCalledWith("drills", 7, {
      video: { source_url: "https://youtu.be/ABC123", title: "Serve receive" },
      start_seconds: 272,
      end_seconds: 378,
      title: "Serve receive",
    });
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  });

  it("rejects malformed timestamps without calling the api", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/video url/i), "https://youtu.be/ABC123");
    await user.type(screen.getByLabelText(/^Start$/i), "4:xx");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(screen.getByText(/Start must use MM:SS/i)).toBeInTheDocument();
    expect(mockedApi.createVideoReference).not.toHaveBeenCalled();
  });

  it("rejects an end that is not after the start", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/video url/i), "https://youtu.be/ABC123");
    await user.type(screen.getByLabelText(/^Start$/i), "06:18");
    await user.type(screen.getByLabelText(/^End$/i), "04:32");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(screen.getByText(/End must be after the start/i)).toBeInTheDocument();
    expect(mockedApi.createVideoReference).not.toHaveBeenCalled();
  });

  it("edits a reference in place: url read-only, video fields untouched", async () => {
    const user = userEvent.setup();
    const existing: VideoReference = {
      ...saved,
      id: 21,
      title: "Old title",
      position: 0,
    };
    renderForm({ initial: existing });

    const urlInput = screen.getByLabelText(/video url/i) as HTMLInputElement;
    expect(urlInput).toBeDisabled();

    await user.clear(screen.getByLabelText(/^Title$/i));
    await user.type(screen.getByLabelText(/^Title$/i), "New title");
    await user.type(screen.getByLabelText(/^Position$/i), "3");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(mockedApi.updateVideoReference).toHaveBeenCalledWith(
      "drills",
      7,
      21,
      expect.objectContaining({ title: "New title", position: 3 }),
    );
    expect(mockedApi.createVideoReference).not.toHaveBeenCalled();
  });

  it("surfaces api validation errors", async () => {
    mockedApi.createVideoReference.mockRejectedValueOnce(
      new (await import("../../api")).ApiValidationError([
        "End seconds must be greater than start_seconds",
      ]),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/video url/i), "https://youtu.be/ABC123");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(
      await screen.findByText(/End seconds must be greater than start_seconds/i),
    ).toBeInTheDocument();
  });
});
