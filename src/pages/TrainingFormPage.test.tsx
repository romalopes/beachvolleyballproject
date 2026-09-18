import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { api, type Category, type Drill, type Skill } from "../api";
import { SAMPLE_DRILL_DEFINITION } from "../components/drill/definition";
import TrainingFormPage from "./TrainingFormPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      categories: vi.fn(),
      skills: vi.fn(),
      drills: vi.fn(),
      createTrainingSession: vi.fn(),
      updateTrainingSession: vi.fn(),
      trainingSession: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const coachUser = { id: 2, name: "Coach", email_address: "coach@x.com", roles: ["coach"] };

const categories: Category[] = [
  { id: 1, name: "Defense", slug: "defense" },
  { id: 2, name: "Serving", slug: "serving" },
];

const skills: Skill[] = [
  { id: 5, title: "Serve Reception", slug: "serve-reception", description: null, category_id: 1 },
  { id: 6, title: "Defensive Movement", slug: "defensive-movement", description: null, category_id: 1 },
];

const drills: Drill[] = [
  {
    id: 10,
    title: "Serve Receive Progression",
    slug: "serve-receive-progression",
    setup_instructions: "",
    training_stage: "middle",
    difficulty_level: "intermediate",
    min_players: 3,
    max_players: 6,
    ideal_num_players: 6,
    definition: SAMPLE_DRILL_DEFINITION,
    skills: [{ id: 5, title: "Serve Reception", slug: "serve-reception", description: null, category_id: 1 }],
  },
  {
    id: 11,
    title: "Game Simulation",
    slug: "game-simulation",
    setup_instructions: "",
    training_stage: "end",
    difficulty_level: "advanced",
    min_players: 6,
    max_players: 12,
    ideal_num_players: 12,
    definition: SAMPLE_DRILL_DEFINITION,
    skills: [],
  },
];

const renderForm = (route = "/training/new") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/training/new" element={<TrainingFormPage />} />
          <Route path="/training/:id/edit" element={<TrainingFormPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.categories.mockResolvedValue(categories);
  mockedApi.skills.mockResolvedValue(skills);
  mockedApi.drills.mockResolvedValue(drills);
  mockedApi.createTrainingSession.mockResolvedValue({ id: 99 } as never);
});

afterEach(cleanup);

const focusSection = () => within(screen.getByRole("group", { name: "Training Focuses" }));
const drillSection = () => within(screen.getByRole("group", { name: "Drills" }));
const drillRowTitles = () =>
  Array.from(
    screen.getByRole("group", { name: "Drills" }).querySelectorAll(
      ".training-drill-editor-row .training-focus-title",
    ),
  ).map((el) => el.textContent);

const addSkillFocus = async () => {
  await userEvent.selectOptions(focusSection().getByLabelText(/^Category$/i), "1");
  await userEvent.selectOptions(focusSection().getByLabelText(/^Skill$/i), "5");
  await userEvent.click(focusSection().getByRole("button", { name: "Add focus" }));
};


describe("TrainingFormPage — new training", () => {
  it("renders the basic information fields", async () => {
    renderForm();
    expect(await screen.findByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText(/focus description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it("offers no skill or drill creation actions", async () => {
    renderForm();
    await screen.findByLabelText(/title/i);
    expect(screen.queryByText(/create skill/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new skill/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create drill/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new drill/i)).not.toBeInTheDocument();
  });

  it("adds a skill focus and a custom focus with descriptions", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);

    await userEvent.selectOptions(focusSection().getByLabelText(/^Category$/i), "1");
    await userEvent.selectOptions(focusSection().getByLabelText(/^Skill$/i), "5");
    await userEvent.type(
      focusSection().getByLabelText(/focus description/i),
      "Focus on platform angle",
    );
    await userEvent.click(focusSection().getByRole("button", { name: "Add focus" }));
    expect(focusSection().getByText("1. Serve Reception")).toBeInTheDocument();
    expect(focusSection().getByText(/Focus on platform angle/)).toBeInTheDocument();

    await userEvent.click(focusSection().getByRole("radio", { name: /custom focus/i }));
    const customInput = focusSection().getByPlaceholderText(/transition communication/i);
    await userEvent.type(customInput, "Transition communication");
    await userEvent.type(
      focusSection().getByLabelText(/focus description/i),
      "Call early after the block",
    );
    await userEvent.click(focusSection().getByRole("button", { name: "Add focus" }));
    expect(
      focusSection().getByText((_, el) => el?.textContent === "2. Transition communication"),
    ).toBeInTheDocument();
    expect(focusSection().getByText(/Call early after the block/)).toBeInTheDocument();
  });


  it("recommends drills from focus skills and allows manual browse + add", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();

    expect(screen.getByText(/Recommended drills based on/i)).toBeInTheDocument();
    expect(screen.getByText(/Serve Receive Progression/)).toBeInTheDocument();
    // "Game Simulation" has no matching skill — not recommended by default.
    expect(screen.queryByText(/Game Simulation/)).not.toBeInTheDocument();

    // Manual browse: uncheck "Recommended only" to see the whole catalogue.
    await userEvent.click(drillSection().getByRole("checkbox", { name: /recommended only/i }));
    expect(screen.getByText(/Game Simulation/)).toBeInTheDocument();

    await userEvent.click(drillSection().getAllByRole("button", { name: /^Add$/i })[0]);
    expect(
      drillSection().getByText((_, el) => el?.textContent === "1. Serve Receive Progression"),
    ).toBeInTheDocument();
  });

  it("edits duration, notes, removes and reorders selected drills", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();
    await userEvent.click(drillSection().getByRole("checkbox", { name: /recommended only/i }));
    // Add the recommended drill, then re-query: the candidate list re-renders after each add.
    await userEvent.click(drillSection().getAllByRole("button", { name: /^Add$/i })[0]);
    await userEvent.click(drillSection().getAllByRole("button", { name: /^Add$/i })[0]);

    expect(drillRowTitles()).toEqual(["1. Serve Receive Progression", "2. Game Simulation"]);

    await userEvent.click(drillSection().getByRole("button", { name: "Move drill 2 up" }));
    expect(drillRowTitles()).toEqual(["1. Game Simulation", "2. Serve Receive Progression"]);

    const duration = drillSection().getAllByLabelText(/duration/i)[0];
    await userEvent.clear(duration);
    await userEvent.type(duration, "15");
    await userEvent.type(drillSection().getAllByLabelText(/notes/i)[0], "Use stronger serves");
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Use stronger serves")).toBeInTheDocument();

    await userEvent.click(drillSection().getByRole("button", { name: "Remove drill 2" }));
    // Remaining drill renumbers to position 1.
    expect(drillRowTitles()).toEqual(["1. Game Simulation"]);
  });

  it("submits the training with nested focuses and drills", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await userEvent.type(screen.getByLabelText(/^Title$/i), "Serve Reception Training");
    await userEvent.type(screen.getByLabelText(/^Date$/i), "2026-09-21");
    await userEvent.type(screen.getByLabelText(/start time/i), "09:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "11:00");
    await userEvent.type(screen.getByLabelText(/location/i), "Coogee Beach");
    await addSkillFocus();
    await userEvent.click(drillSection().getByRole("button", { name: /^Add$/i }));
    await userEvent.click(screen.getByRole("button", { name: /Create Training/i }));

    expect(mockedApi.createTrainingSession).toHaveBeenCalledTimes(1);
    const payload = mockedApi.createTrainingSession.mock.calls[0][0];
    expect(payload.title).toBe("Serve Reception Training");
    expect(payload.status).toBe("draft");
    expect(payload.training_focuses_attributes?.[0]?.skill_id).toBe(5);
    expect(payload.training_session_drills_attributes?.[0]?.drill_id).toBe(10);
    expect(payload.training_session_drills_attributes?.[0]?.position).toBe(1);
  });

  it("blocks submission when the end time is not after the start time", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await userEvent.type(screen.getByLabelText(/^Title$/i), "Bad times");
    await userEvent.type(screen.getByLabelText(/^Date$/i), "2026-09-21");
    await userEvent.type(screen.getByLabelText(/start time/i), "11:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "09:00");
    await userEvent.click(screen.getByRole("button", { name: /Create Training/i }));
    expect(await screen.findByText(/End time must be after start time/i)).toBeInTheDocument();
    expect(mockedApi.createTrainingSession).not.toHaveBeenCalled();
  });
});


