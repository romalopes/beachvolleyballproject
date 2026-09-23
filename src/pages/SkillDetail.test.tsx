/**
 * SkillDetail — the videos section reuses the same VideoList the drill page
 * uses, so a skill's clips behave identically (embed where supported, watch
 * link otherwise).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Skill, type VideoReference } from "../api";
import SkillDetail from "./SkillDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      skill: vi.fn(),
      drills: vi.fn(),
      adminDestroySkill: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const videoReference: VideoReference = {
  id: 21,
  start_seconds: null,
  end_seconds: null,
  title: "Float serve breakdown",
  description: null,
  position: 0,
  can_embed: false,
  embed_url: null,
  external_url: "https://www.instagram.com/p/Cfloat99/",
  video: {
    id: 5,
    title: null,
    provider: "instagram",
    source_url: "https://www.instagram.com/p/Cfloat99/",
    thumbnail_url: null,
    duration_seconds: null,
    provider_label: "Instagram",
  },
};

const skill = {
  id: 9,
  title: "Float Serve",
  slug: "float-serve",
  description: "Serving without spin.",
  category_id: 2,
  video_references: [videoReference],
} as Skill;

const renderSkill = () =>
  render(
    <MemoryRouter initialEntries={["/skills/float-serve"]}>
      <AuthProvider>
        <Routes>
          <Route path="/skills/:slug" element={<SkillDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(null);
  mockedApi.skill.mockResolvedValue(skill);
  mockedApi.drills.mockResolvedValue([] as never);
});

afterEach(cleanup);

describe("SkillDetail — videos", () => {
  it("shows the skill's videos with the non-embeddable fallback", async () => {
    renderSkill();

    expect(
      await screen.findByRole("heading", { name: "Videos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Float serve breakdown")).toBeInTheDocument();
    // Instagram never embeds: a watch link, never a broken iframe.
    expect(document.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("link", { name: /watch on instagram/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/p/Cfloat99/");
  });

  it("shows the empty state when the skill has no videos", async () => {
    mockedApi.skill.mockResolvedValue({ ...skill, video_references: [] } as Skill);
    renderSkill();

    expect(await screen.findByText("No videos yet")).toBeInTheDocument();
  });
});
