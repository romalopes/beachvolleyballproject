/**
 * DrillDetail — "no definition yet" has to be visible, not papered over.
 *
 * Rails defaults the `definition` column to `{}`, and a pre-`side` definition
 * is not renderable either. The page used to answer both with the built-in
 * sample drill, so a drill everyone believed had players, balls, objects and
 * steps really had none. The sample is now opt-in and labelled.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Drill } from "../api";
import type { VideoReference } from "../api";
import { SAMPLE_DRILL_DEFINITION } from "../components/drill/definition";
import DrillDetail from "./DrillDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      drill: vi.fn(),
      adminDestroyDrill: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const adminUser = {
  id: 2,
  name: "Admin",
  email_address: "admin@example.com",
  roles: ["admin", "coach"],
};

/** The shape the API returns for a drill — `definition: {}` is the default. */
const drillWith = (definition: unknown): Drill =>
  ({
    id: 34,
    title: "Block Landing and Turn",
    slug: "block-landing-and-turn",
    setup_instructions: "Land balanced and turn to face the court.",
    training_stage: "middle",
    difficulty_level: "intermediate",
    min_players: 2,
    max_players: 4,
    ideal_num_players: 4,
    definition,
    skills: [],
  }) as Drill;

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/drills/block-landing-and-turn"]}>
      <AuthProvider>
        <Routes>
          <Route path="/drills/:slug" element={<DrillDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

/** The drill has loaded once its title is on the page. */
const loaded = () =>
  screen.findByRole("heading", { name: "Block Landing and Turn" });

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(adminUser);
});

afterEach(cleanup);

describe("DrillDetail — videos", () => {
  const videoReference = (id: number, provider: string, source: string): VideoReference => ({
    id,
    start_seconds: 272,
    end_seconds: 378,
    title: `Clip ${id}`,
    description: null,
    position: id - 10,
    can_embed: provider === "youtube",
    embed_url:
      provider === "youtube" ? "https://www.youtube-nocookie.com/embed/ABC123?start=272&end=378" : null,
    external_url: source,
    video: {
      id,
      title: null,
      provider,
      source_url: source,
      thumbnail_url: provider === "youtube" ? "https://i.ytimg.com/vi/ABC123/hqdefault.jpg" : null,
      duration_seconds: null,
      provider_label: provider === "youtube" ? "YouTube" : "Instagram",
    },
  });

  it("shows an embedded video and a graceful fallback on the drill page", async () => {
    const drill = {
      ...drillWith({}),
      video_references: [
        videoReference(11, "youtube", "https://www.youtube.com/watch?v=ABC123"),
        videoReference(12, "instagram", "https://www.instagram.com/p/Cabc123/"),
      ],
    } as Drill;
    mockedApi.drill.mockResolvedValue(drill);
    renderDetail();
    await loaded();

    expect(screen.getByRole("heading", { name: "Videos" })).toBeInTheDocument();
    // YouTube embeds by default (first by position)…
    expect(screen.getByTitle("Clip 11")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/ABC123?start=272&end=378",
    );
    // …and selecting the Instagram clip shows the fallback, never an iframe.
    await userEvent.click(screen.getAllByRole("button", { name: /Clip 12/ })[0]);
    expect(
      screen.getByRole("link", { name: /watch on instagram/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/p/Cabc123/");
    // The window is shown on both the player and the list entry.
    expect(screen.getAllByText("04:32 – 06:18").length).toBeGreaterThan(0);
  });

  it("shows the empty state for a drill without videos", async () => {
    mockedApi.drill.mockResolvedValue(drillWith({}));
    renderDetail();
    await loaded();

    expect(screen.getByText("No videos yet")).toBeInTheDocument();
  });
});

describe("DrillDetail — drills without a renderable definition", () => {
  it("says there is no visualisation instead of showing a sample", async () => {
    mockedApi.drill.mockResolvedValue(drillWith({}));
    renderDetail();
    await loaded();

    expect(screen.getByText("No visualisation yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show a sample" }),
    ).toBeInTheDocument();
    // The sample is not smuggled in: nothing renders until it is asked for.
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide sample" })).toBeNull();
  });

  it("labels the sample when the visitor asks for it", async () => {
    mockedApi.drill.mockResolvedValue(drillWith({}));
    const user = userEvent.setup();
    renderDetail();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Show a sample" }));

    expect(screen.getByRole("note")).toHaveTextContent(/Sample drill/i);
    expect(
      screen.getByRole("button", { name: "Hide sample" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide sample" }));

    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByText("No visualisation yet")).toBeInTheDocument();
  });

  it("shows the stored JSON, never the sample's", async () => {
    mockedApi.drill.mockResolvedValue(drillWith({ version: 1 }));
    renderDetail();
    await loaded();

    await userEvent.click(screen.getByText("Show / hide JSON"));

    expect(
      screen.getByText(/the JSON below is what the API returned/i),
    ).toBeInTheDocument();
    expect(document.querySelector(".drill-json-viewer")?.textContent).toBe(
      JSON.stringify({ version: 1 }, null, 2),
    );
  });

  it("numbers the stored JSON down the left, one per line", async () => {
    mockedApi.drill.mockResolvedValue(drillWith({ version: 1 }));
    renderDetail();
    await loaded();

    await userEvent.click(screen.getByText("Show / hide JSON"));

    const gutter = document.querySelector(".line-numbered-code__gutter")!;
    expect(gutter.textContent).toBe("1\n2\n3");
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the drill's own definition with no sample notice", async () => {
    mockedApi.drill.mockResolvedValue(drillWith(SAMPLE_DRILL_DEFINITION));
    renderDetail();
    await loaded();

    expect(screen.queryByText("No visualisation yet")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show a sample" })).toBeNull();
  });
});
