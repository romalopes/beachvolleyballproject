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
import { AuthProvider } from "../auth/AuthContext";
import { api, type Drill } from "../api";
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
    media_assets: [],
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

  it("renders the drill's own definition with no sample notice", async () => {
    mockedApi.drill.mockResolvedValue(drillWith(SAMPLE_DRILL_DEFINITION));
    renderDetail();
    await loaded();

    expect(screen.queryByText("No visualisation yet")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show a sample" })).toBeNull();
  });
});
