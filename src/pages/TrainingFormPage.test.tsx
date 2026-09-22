import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import {
  api,
  type Category,
  type Drill,
  type Skill,
  type TrainingSession,
} from "../api";
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
      drill: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const coachUser = {
  id: 2,
  name: "Coach",
  email_address: "coach@x.com",
  roles: ["coach"],
};

const categories: Category[] = [
  { id: 1, name: "Defense", slug: "defense" },
  { id: 2, name: "Serving", slug: "serving" },
];

const skills: Skill[] = [
  {
    id: 5,
    title: "Serve Reception",
    slug: "serve-reception",
    description: null,
    category_id: 1,
  },
  {
    id: 6,
    title: "Defensive Movement",
    slug: "defensive-movement",
    description: null,
    category_id: 1,
  },
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
    skills: [
      {
        id: 5,
        title: "Serve Reception",
        slug: "serve-reception",
        description: null,
        category_id: 1,
      },
    ],
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
  {
    id: 12,
    title: "Defensive Shuffle",
    slug: "defensive-shuffle",
    setup_instructions: "",
    training_stage: "beginning",
    difficulty_level: "beginner",
    min_players: 3,
    max_players: 6,
    ideal_num_players: 6,
    definition: SAMPLE_DRILL_DEFINITION,
    skills: [
      {
        id: 6,
        title: "Defensive Movement",
        slug: "defensive-movement",
        description: null,
        category_id: 1,
      },
    ],
  },
];

const renderForm = (route = "/training/new") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/training/new" element={<TrainingFormPage />} />
          <Route path="/training/:id/edit" element={<TrainingFormPage />} />
          {/* Stub for the post-save redirect so the router never warns about a
              location that has no match in this focused test. */}
          <Route path="/training/:id" element={<div>Training detail</div>} />
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

const focusSection = () =>
  within(screen.getByRole("group", { name: "Training Focuses" }));
const drillSection = () =>
  within(screen.getByRole("group", { name: "Drills" }));
const drillRowTitles = () =>
  Array.from(
    screen
      .getByRole("group", { name: "Drills" })
      .querySelectorAll(".training-drill-editor-row .training-focus-title"),
  ).map((el) => el.textContent);

const addSkillFocus = async (skillId = "5") => {
  await userEvent.selectOptions(
    focusSection().getByLabelText(/^Category$/i),
    "1",
  );
  await userEvent.selectOptions(
    focusSection().getByLabelText(/^Skill$/i),
    skillId,
  );
  await userEvent.click(
    focusSection().getByRole("button", { name: "Add focus" }),
  );
};

describe("TrainingFormPage — new training", () => {
  it("renders the basic information fields", async () => {
    renderForm();
    expect(await screen.findByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText(/focus description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    const duration = screen.getByLabelText(/^Duration$/i);
    // A 1:30h session is the default, offered alongside the other presets.
    expect(duration).toHaveValue("90");
    expect(
      within(duration)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["30min", "1hour", "1:30h", "2:00h"]);
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

    await userEvent.selectOptions(
      focusSection().getByLabelText(/^Category$/i),
      "1",
    );
    await userEvent.selectOptions(
      focusSection().getByLabelText(/^Skill$/i),
      "5",
    );
    await userEvent.type(
      focusSection().getByLabelText(/focus description/i),
      "Focus on platform angle",
    );
    await userEvent.click(
      focusSection().getByRole("button", { name: "Add focus" }),
    );
    expect(focusSection().getByText("1. Serve Reception")).toBeInTheDocument();
    expect(
      focusSection().getByText(/Focus on platform angle/),
    ).toBeInTheDocument();

    await userEvent.click(
      focusSection().getByRole("radio", { name: /custom focus/i }),
    );
    const customInput = focusSection().getByPlaceholderText(
      /transition communication/i,
    );
    await userEvent.type(customInput, "Transition communication");
    await userEvent.type(
      focusSection().getByLabelText(/focus description/i),
      "Call early after the block",
    );
    await userEvent.click(
      focusSection().getByRole("button", { name: "Add focus" }),
    );
    expect(
      focusSection().getByText(
        (_, el) => el?.textContent === "2. Transition communication",
      ),
    ).toBeInTheDocument();
    expect(
      focusSection().getByText(/Call early after the block/),
    ).toBeInTheDocument();
  });

  it("recommends drills from focus skills and allows manual browse + add", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();

    expect(
      screen.getByText(/Recommended drills based on/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Serve Receive Progression/)).toBeInTheDocument();
    // "Game Simulation" has no matching skill — not recommended by default.
    expect(screen.queryByText(/Game Simulation/)).not.toBeInTheDocument();

    // Manual browse: uncheck "Recommended only" to see the whole catalogue.
    await userEvent.click(
      drillSection().getByRole("checkbox", { name: /recommended only/i }),
    );
    expect(screen.getByText(/Game Simulation/)).toBeInTheDocument();

    await userEvent.click(
      drillSection().getAllByRole("button", { name: /^Add$/i })[0],
    );
    expect(
      drillSection().getByText(
        (_, el) => el?.textContent === "1. Serve Receive Progression",
      ),
    ).toBeInTheDocument();
  });

  it("shows the visualisation for a newly added drill whose index payload lacks a definition", async () => {
    // The drills index endpoint strips `definition`; the full drill detail
    // (fetched per selected drill) carries it back.
    mockedApi.drills.mockResolvedValue(
      drills.map((drill) => ({ ...drill, definition: undefined })),
    );
    mockedApi.drill.mockResolvedValue(drills[0]);

    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();

    await userEvent.click(
      drillSection().getAllByRole("button", { name: /^Add$/i })[0],
    );
    expect(
      drillSection().getByText(
        (_, el) => el?.textContent === "1. Serve Receive Progression",
      ),
    ).toBeInTheDocument();

    // The fetched definition renders instead of the empty placeholder.
    expect(
      drillSection().queryByText(/no visualisation yet/i),
    ).not.toBeInTheDocument();
    expect(mockedApi.drill).toHaveBeenCalledWith("serve-receive-progression");
  });

  it("edits duration, notes, removes and reorders selected drills", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();
    await userEvent.click(
      drillSection().getByRole("checkbox", { name: /recommended only/i }),
    );
    // Add the recommended drill, then re-query: the candidate list re-renders after each add.
    await userEvent.click(
      drillSection().getAllByRole("button", { name: /^Add$/i })[0],
    );
    await userEvent.click(
      drillSection().getAllByRole("button", { name: /^Add$/i })[0],
    );

    expect(drillRowTitles()).toEqual([
      "1. Serve Receive Progression",
      "2. Game Simulation",
    ]);

    await userEvent.click(
      drillSection().getByRole("button", { name: "Move drill 2 up" }),
    );
    expect(drillRowTitles()).toEqual([
      "1. Game Simulation",
      "2. Serve Receive Progression",
    ]);

    const duration = drillSection().getAllByLabelText(/duration/i)[0];
    // Drill lengths come from a fixed list instead of free text.
    expect(
      within(duration)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Not set", "5", "10", "15", "20", "30", "40", "60"]);
    await userEvent.selectOptions(duration, "15");
    await userEvent.type(
      drillSection().getAllByLabelText(/notes/i)[0],
      "Use stronger serves",
    );
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Use stronger serves")).toBeInTheDocument();

    await userEvent.click(
      drillSection().getByRole("button", { name: "Remove drill 2" }),
    );
    // Remaining drill renumbers to position 1.
    expect(drillRowTitles()).toEqual(["1. Game Simulation"]);
  });

  it("submits the training with nested focuses and drills", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await userEvent.type(
      screen.getByLabelText(/^Title$/i),
      "Serve Reception Training",
    );
    await userEvent.type(screen.getByLabelText(/^Date$/i), "2026-09-21");
    await userEvent.type(screen.getByLabelText(/start time/i), "09:00");
    await userEvent.selectOptions(screen.getByLabelText(/^Duration$/i), "120");
    await userEvent.type(screen.getByLabelText(/location/i), "Coogee Beach");
    await addSkillFocus();
    await userEvent.click(
      drillSection().getByRole("button", { name: /^Add$/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Create Training/i }),
    );

    expect(mockedApi.createTrainingSession).toHaveBeenCalledTimes(1);
    const payload = mockedApi.createTrainingSession.mock.calls[0][0];
    expect(payload.title).toBe("Serve Reception Training");
    expect(payload.status).toBe("draft");
    // 09:00 + the picked 2:00h becomes the end time the API expects.
    expect(payload.starts_at).toBe(new Date("2026-09-21T09:00").toISOString());
    expect(payload.ends_at).toBe(new Date("2026-09-21T11:00").toISOString());
    expect(payload.training_focuses_attributes?.[0]?.skill_id).toBe(5);
    expect(payload.training_session_drills_attributes?.[0]?.drill_id).toBe(10);
    expect(payload.training_session_drills_attributes?.[0]?.position).toBe(1);
  });

  it("defaults to a 1:30h session and derives the end time", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await userEvent.type(screen.getByLabelText(/^Title$/i), "Default length");
    await userEvent.type(screen.getByLabelText(/^Date$/i), "2026-09-21");
    await userEvent.type(screen.getByLabelText(/start time/i), "09:00");
    expect(screen.getByLabelText(/^Duration$/i)).toHaveValue("90");

    await userEvent.click(
      screen.getByRole("button", { name: /Create Training/i }),
    );

    const payload = mockedApi.createTrainingSession.mock.calls[0][0];
    expect(payload.ends_at).toBe(new Date("2026-09-21T10:30").toISOString());
  });

  it("blocks submission when the start time is missing", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await userEvent.type(screen.getByLabelText(/^Title$/i), "No start time");
    await userEvent.type(screen.getByLabelText(/^Date$/i), "2026-09-21");
    await userEvent.click(
      screen.getByRole("button", { name: /Create Training/i }),
    );
    expect(
      await screen.findByText(/Date and start time are required/i),
    ).toBeInTheDocument();
    expect(mockedApi.createTrainingSession).not.toHaveBeenCalled();
  });

  it("narrows the drill list as the coach types a name", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus();

    // Recommended mode: only "Serve Receive Progression" matches "serve".
    const search = drillSection().getByLabelText(/search drills/i);
    await userEvent.type(search, "serve");
    expect(screen.getByText("Serve Receive Progression")).toBeInTheDocument();
    expect(screen.queryByText("Game Simulation")).not.toBeInTheDocument();

    // A recommended-mode search that finds nothing points at the toggle.
    await userEvent.clear(search);
    await userEvent.type(search, "game");
    expect(
      screen.getByText(/No recommended drills match/i),
    ).toBeInTheDocument();

    // Unticking "Recommended only" searches the whole catalogue instead.
    await userEvent.click(
      drillSection().getByRole("checkbox", { name: /recommended only/i }),
    );
    expect(screen.getByText("Game Simulation")).toBeInTheDocument();
    expect(
      screen.queryByText("Serve Receive Progression"),
    ).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    expect(screen.getByText(/No drills match/i)).toBeInTheDocument();
  });

  it("filters the drill list by the selected focus skill", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus("5");
    await addSkillFocus("6");

    const skillFilter = drillSection().getByLabelText(
      /filter drills by skill/i,
    );
    expect(
      within(skillFilter)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All skills", "Serve Reception", "Defensive Movement"]);

    // Picking a skill narrows the recommended drills to that skill's drills.
    await userEvent.selectOptions(skillFilter, "6");
    expect(screen.getByText("Defensive Shuffle")).toBeInTheDocument();
    expect(
      screen.queryByText("Serve Receive Progression"),
    ).not.toBeInTheDocument();

    // "All skills" restores the combined recommendation.
    await userEvent.selectOptions(skillFilter, "");
    expect(screen.getByText("Serve Receive Progression")).toBeInTheDocument();

    // The same filter composes with the full-catalogue view.
    await userEvent.click(
      drillSection().getByRole("checkbox", { name: /recommended only/i }),
    );
    expect(screen.getByText("Game Simulation")).toBeInTheDocument();
    await userEvent.selectOptions(
      drillSection().getByLabelText(/filter drills by skill/i),
      "6",
    );
    expect(screen.getByText("Defensive Shuffle")).toBeInTheDocument();
    expect(screen.queryByText("Game Simulation")).not.toBeInTheDocument();
  });

  it("clears the skill filter when that focus is removed", async () => {
    renderForm();
    await screen.findByLabelText(/^Title$/i);
    await focusSection().findByLabelText(/^Category$/i);
    await addSkillFocus("5");
    await addSkillFocus("6");
    await userEvent.selectOptions(
      drillSection().getByLabelText(/filter drills by skill/i),
      "6",
    );
    expect(
      screen.queryByText("Serve Receive Progression"),
    ).not.toBeInTheDocument();

    // Removing the Defensive Movement focus resets the filter, so the remaining
    // skill's drills come back instead of an empty list.
    await userEvent.click(
      focusSection().getByRole("button", { name: "Remove focus 2" }),
    );
    expect(
      drillSection().getByLabelText(/filter drills by skill/i),
    ).toHaveValue("");
    expect(screen.getByText("Serve Receive Progression")).toBeInTheDocument();
  });
});

describe("TrainingFormPage — editing an existing training", () => {
  const existingSession: TrainingSession = {
    id: 2,
    title: "Existing Training",
    description: "Weekly session",
    starts_at: "2026-09-21T09:00:00.000Z",
    ends_at: "2026-09-21T11:00:00.000Z",
    location: "Coogee Beach",
    status: "scheduled",
    created_by_id: 2,
    training_focuses: [
      {
        id: 7,
        skill_id: 5,
        custom_focus: null,
        description: "Platform angle",
        position: 1,
        label: "Serve Reception",
      },
    ],
    training_session_drills: [
      {
        id: 8,
        drill_id: 10,
        position: 1,
        duration_minutes: 15,
        notes: "Strong serves",
        drill: drills[0],
      },
    ],
  };

  it("updates existing focuses and drills in place instead of duplicating them", async () => {
    mockedApi.trainingSession.mockResolvedValue(existingSession);
    mockedApi.updateTrainingSession.mockResolvedValue({ id: 2 } as never);

    renderForm("/training/2/edit");

    expect(
      await screen.findByDisplayValue("Existing Training"),
    ).toBeInTheDocument();
    expect(focusSection().getByText("1. Serve Reception")).toBeInTheDocument();
    expect(drillRowTitles()).toEqual(["1. Serve Receive Progression"]);

    await userEvent.click(
      screen.getByRole("button", { name: /Save Changes/i }),
    );

    expect(mockedApi.createTrainingSession).not.toHaveBeenCalled();
    expect(mockedApi.updateTrainingSession).toHaveBeenCalledTimes(1);
    const [id, payload] = mockedApi.updateTrainingSession.mock.calls[0];

    expect(id).toBe(2);
    // The persisted focus keeps its id, so the API updates it rather than
    // inserting a second focus for the same skill (which is rejected as
    // "skill has already been taken").
    expect(payload.training_focuses_attributes).toEqual([
      {
        id: 7,
        skill_id: 5,
        custom_focus: null,
        description: "Platform angle",
        position: 1,
      },
    ]);
    expect(payload.training_session_drills_attributes).toEqual([
      {
        id: 8,
        drill_id: 10,
        position: 1,
        duration_minutes: 15,
        notes: "Strong serves",
      },
    ]);
  });

  it("marks a removed focus for destruction instead of dropping it", async () => {
    mockedApi.trainingSession.mockResolvedValue(existingSession);
    mockedApi.updateTrainingSession.mockResolvedValue({ id: 2 } as never);

    renderForm("/training/2/edit");
    await screen.findByDisplayValue("Existing Training");

    await userEvent.click(
      focusSection().getByRole("button", { name: "Remove focus 1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Save Changes/i }),
    );

    const [, payload] = mockedApi.updateTrainingSession.mock.calls[0];
    expect(payload.training_focuses_attributes).toEqual([
      { id: 7, _destroy: true },
    ]);
  });

  it("preserves a session length that is not one of the presets", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...existingSession,
      ends_at: "2026-09-21T10:45:00.000Z",
    });
    mockedApi.updateTrainingSession.mockResolvedValue({ id: 2 } as never);

    renderForm("/training/2/edit");
    await screen.findByDisplayValue("Existing Training");

    // 09:00 → 10:45 is 1h45m, so the form offers that length back (105) instead
    // of silently snapping the session to one of the presets.
    const duration = screen.getByLabelText(/^Duration$/i);
    expect(duration).toHaveValue("105");
    expect(
      within(duration).getByRole("option", { name: "1:45h" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Save Changes/i }),
    );

    const [, payload] = mockedApi.updateTrainingSession.mock.calls[0];
    expect(payload.ends_at).toBe("2026-09-21T10:45:00.000Z");
  });

  it("preserves a drill duration that is not one of the presets", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...existingSession,
      training_session_drills: [
        {
          ...existingSession.training_session_drills![0],
          duration_minutes: 25,
        },
      ],
    });
    mockedApi.updateTrainingSession.mockResolvedValue({ id: 2 } as never);

    renderForm("/training/2/edit");
    await screen.findByDisplayValue("Existing Training");

    const duration = drillSection().getAllByLabelText(/duration/i)[0];
    expect(duration).toHaveValue("25");
    expect(
      within(duration).getByRole("option", { name: "25" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Save Changes/i }),
    );

    const [, payload] = mockedApi.updateTrainingSession.mock.calls[0];
    expect(
      payload.training_session_drills_attributes?.[0]?.duration_minutes,
    ).toBe(25);
  });
});
