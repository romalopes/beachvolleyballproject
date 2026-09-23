/**
 * Drills (public list) — the filter toolbar mirrors the settings drill list:
 * every filter is a select/number input plus the "only drills with visual
 * definition" boolean, so a drill's visualisation state is filterable.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Category, type Drill, type Skill } from "../api";
import Drills from "./Drills";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      drills: vi.fn(),
      skills: vi.fn(),
      categories: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const offense: Category = { id: 1, name: "Offense", slug: "offense" };
const defense: Category = { id: 2, name: "Defense", slug: "defense" };

const spike: Skill = {
  id: 10,
  title: "Spike",
  slug: "spike",
  description: null,
  category_id: 1,
  category: offense,
};

const dig: Skill = {
  id: 20,
  title: "Dig",
  slug: "dig",
  description: null,
  category_id: 2,
  category: defense,
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

const renderDrills = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Drills />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(null);
  mockedApi.categories.mockResolvedValue([offense, defense]);
  mockedApi.skills.mockResolvedValue([spike, dig]);
  mockedApi.drills.mockResolvedValue([alpha, beta]);
});

describe("Drills — filter toolbar", () => {
  it("renders the select-based filters and the visual-definition toggle", async () => {
    renderDrills();
    await screen.findByText("Alpha Spike");

    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by training stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by difficulty level")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by min players")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by max players")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort drills")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /only drills with visual definition/i }),
    ).toBeInTheDocument();
  });

  it("filters to drills that carry a visual definition", async () => {
    const user = userEvent.setup();
    renderDrills();
    await screen.findByText("Alpha Spike");
    expect(screen.getByText("Beta Spike")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: /only drills with visual definition/i }),
    );

    expect(screen.getByText("Alpha Spike")).toBeInTheDocument();
    expect(screen.queryByText("Beta Spike")).not.toBeInTheDocument();
  });

  it("orders the drills A–Z and Z–A", async () => {
    const user = userEvent.setup();
    const { container } = renderDrills();
    await screen.findByText("Alpha Spike");

    const titles = () =>
      Array.from(container.querySelectorAll(".drill-card .card-title")).map(
        (el) => el.textContent,
      );
    expect(titles()).toEqual(["Alpha Spike", "Beta Spike"]);

    await user.selectOptions(screen.getByLabelText("Sort drills"), "name-desc");
    expect(titles()).toEqual(["Beta Spike", "Alpha Spike"]);
  });

  it("reports an invalid min/max player window", async () => {
    const user = userEvent.setup();
    renderDrills();
    await screen.findByText("Alpha Spike");

    await user.type(screen.getByLabelText("Filter by min players"), "8");
    await user.type(screen.getByLabelText("Filter by max players"), "2");

    expect(
      screen.getByText("Min players cannot exceed max players."),
    ).toBeInTheDocument();
  });
});
