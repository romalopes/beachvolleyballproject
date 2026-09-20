/**
 * settings/Drills — the visual-definition control is a tri-state select
 * ("Any definition" / "Has a definition" / "No definition") beside the other
 * filters. The API exposes the state as `has_definition` on the list payload.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Category, type Drill, type Skill } from "../../api";
import Drills from "./Drills";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      adminDrills: vi.fn(),
      adminSkills: vi.fn(),
      adminCategories: vi.fn(),
      adminDestroyDrill: vi.fn(),
    },
  };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Admin", email_address: "a@b.c", roles: ["admin"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const offense: Category = { id: 1, name: "Offense", slug: "offense" };

const spike: Skill = {
  id: 10,
  title: "Spike",
  slug: "spike",
  description: null,
  category_id: 1,
  category: offense,
};

const makeDrill = (overrides: Partial<Drill>): Drill => ({
  id: 1,
  title: "Drill",
  slug: "drill",
  setup_instructions: "",
  training_stage: "beginning",
  difficulty_level: "beginner",
  min_players: 2,
  max_players: 8,
  ideal_num_players: 4,
  has_definition: false,
  skills: [spike],
  ...overrides,
});

const alpha = makeDrill({
  id: 1,
  title: "Alpha Spike",
  slug: "alpha-spike",
  has_definition: true,
});
const beta = makeDrill({
  id: 2,
  title: "Beta Spike",
  slug: "beta-spike",
  has_definition: false,
});

const meta = { page: 1, per_page: 1, total: 1, total_pages: 1 };

const renderPage = () =>
  render(
    <MemoryRouter>
      <Drills />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.adminDrills.mockResolvedValue({
    data: [alpha, beta],
    meta: { ...meta, per_page: 2, total: 2 },
  });
  mockedApi.adminSkills.mockResolvedValue({ data: [spike], meta });
  mockedApi.adminCategories.mockResolvedValue({ data: [offense], meta });
});

describe("settings Drills — visual definition filter", () => {
  it("defaults to showing drills with and without a definition", async () => {
    renderPage();

    expect(await screen.findByText("Alpha Spike")).toBeInTheDocument();
    expect(screen.getByText("Beta Spike")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Filter by visual definition"),
    ).toHaveValue("all");
  });

  it("shows only drills without a visual definition", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alpha Spike");

    await user.selectOptions(
      screen.getByLabelText("Filter by visual definition"),
      "without",
    );

    expect(screen.getByText("Beta Spike")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Spike")).not.toBeInTheDocument();
  });

  it("shows only drills that carry a visual definition", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Beta Spike");

    await user.selectOptions(
      screen.getByLabelText("Filter by visual definition"),
      "with",
    );

    expect(screen.getByText("Alpha Spike")).toBeInTheDocument();
    expect(screen.queryByText("Beta Spike")).not.toBeInTheDocument();
  });

  it("resets the definition filter back to Any definition via Clear", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alpha Spike");

    await user.selectOptions(
      screen.getByLabelText("Filter by visual definition"),
      "without",
    );
    expect(screen.queryByText("Alpha Spike")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    expect(screen.getByLabelText("Filter by visual definition")).toHaveValue(
      "all",
    );
    expect(screen.getByText("Alpha Spike")).toBeInTheDocument();
    expect(screen.getByText("Beta Spike")).toBeInTheDocument();
  });
});
