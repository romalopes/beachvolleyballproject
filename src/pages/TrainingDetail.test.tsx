import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type Drill, type TrainingSession, type TrainingSessionParticipant } from "../api";
import { SAMPLE_DRILL_DEFINITION } from "../components/drill/definition";
import TrainingDetail from "./TrainingDetail";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      trainingSession: vi.fn(),
      updateTrainingSession: vi.fn(),
      deleteTrainingSession: vi.fn(),
      createVideoReference: vi.fn(),
      updateVideoReference: vi.fn(),
      removeVideoReference: vi.fn(),
      videos: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const coachUser = { id: 2, name: "Coach", email_address: "coach@x.com", roles: ["coach"] };
const playerUser = { id: 1, name: "Player", email_address: "player@x.com", roles: ["player"] };

const drill: Drill = {
  id: 10,
  title: "Serve Receive Progression",
  slug: "serve-receive-progression",
  setup_instructions: "Three passers rotate through serve receive.",
  training_stage: "middle",
  difficulty_level: "intermediate",
  min_players: 3,
  max_players: 6,
  ideal_num_players: 6,
  definition: SAMPLE_DRILL_DEFINITION,
  skills: [{ id: 5, title: "Serve Reception", slug: "serve-reception", description: null, category_id: 1 }],
};

const fullSession: TrainingSession = {
  id: 1,
  title: "Serve Reception Training",
  description: "Monday morning session.",
  starts_at: "2026-09-21T09:00:00.000Z",
  ends_at: "2026-09-21T11:00:00.000Z",
  location: "Coogee Beach",
  status: "scheduled",
  visibility: "shared",
  created_by_id: 2,
  duration_minutes: 120,
  status_label: "Scheduled",
  training_focuses: [
    {
      id: 1,
      skill_id: 5,
      custom_focus: null,
      description: "Focus on platform angle against float serves.",
      position: 0,
      skill: { id: 5, title: "Serve Reception", slug: "serve-reception", description: null, category: { id: 1, name: "Defense", slug: "defense" } },
    },
    {
      id: 2,
      skill_id: null,
      custom_focus: "Transition communication",
      description: "Players should call early after the block.",
      position: 1,
    },
  ],
  training_session_drills: [
    {
      id: 1,
      drill_id: 10,
      position: 0,
      duration_minutes: 15,
      notes: "Use stronger serves for the second round.",
      drill,
    },
  ],
};

const participants: TrainingSessionParticipant[] = [
  {
    id: 5,
    player_profile_id: 10,
    status: "invited",
    notes: null,
    player_name: "Maria Silva",
    account_connected: true,
  },
  {
    id: 6,
    player_profile_id: 11,
    status: "confirmed",
    notes: "First session back",
    player_name: "Pedro Santos",
    account_connected: false,
  },
];

const renderDetail = (route = "/training/1") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/training/:id" element={<TrainingDetail />} />
          <Route path="/training" element={<div>Training list page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(coachUser);
  mockedApi.trainingSession.mockResolvedValue(fullSession);
});
afterEach(cleanup);

describe("TrainingDetail", () => {
  it("renders title, focuses, drills and session notes", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Serve Reception Training" })).toBeInTheDocument();
    expect(screen.getByText("Focus on platform angle against float serves.")).toBeInTheDocument();
    // Custom focus text sits inside the numbered title span, so match flexibly.
    expect(screen.getByText("Transition communication", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Players should call early after the block.")).toBeInTheDocument();
    expect(screen.getByText("Serve Receive Progression")).toBeInTheDocument();
    expect(screen.getByText("Use stronger serves for the second round.", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Three passers rotate through serve receive.")).toBeInTheDocument();
  });

  it("renders drill steps from the drill definition", async () => {
    renderDetail();
    await screen.findByText("Serve Receive Progression");
    const steps = SAMPLE_DRILL_DEFINITION.steps;
    expect(steps.length).toBeGreaterThan(0);
    // Steps also appear inside the DrillViewer canvas; scope to the steps list.
    const stepsList = document.querySelector(".training-drill-steps");
    expect(stepsList).not.toBeNull();
    expect(stepsList?.textContent).toContain(steps[0].description);
  });

  it("shows Edit and Delete to coaches and deletes with confirm", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("Serve Receive Progression");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(mockedApi.deleteTrainingSession).toHaveBeenCalledWith(1);
    expect(await screen.findByText("Training list page")).toBeInTheDocument();
  });

  it("hides Edit and Delete from players", async () => {
    mockedApi.me.mockResolvedValue(playerUser);
    renderDetail();
    await screen.findByText("Serve Receive Progression");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows the videos section with the empty state", async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Videos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No videos yet")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("shows assessments recorded during the session per participant", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      training_session_participants: [
        { ...participants[0], assessments: [{
          id: 1, player_profile_id: 10, coach_profile_id: 7, category_id: 5, custom_category: null,
          training_session_id: 1, score: 70, reported_value: 4, scale: "one_to_five",
          notes: null, status: "active", created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z", category_label: "Attack", ten_scale: 7,
          five_scale: 4, score_label: "70/100", status_label: "Published",
          created_by: { id: 2, name: "Coach Ana" },
          category: { id: 5, name: "Attack", slug: "attack" },
        }] },
        participants[1],
      ],
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Assessments in this session" })).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("70/100 · 7/10 · 4/5")).toBeInTheDocument();
  });

  it("renders an attached video with its embed and watch link", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      video_references: [
        {
          id: 31,
          start_seconds: 272,
          end_seconds: 378,
          title: "Session recording",
          description: null,
          position: 0,
          can_embed: true,
          embed_url: "https://www.youtube-nocookie.com/embed/Rec123?start=272&end=378",
          external_url: "https://www.youtube.com/watch?v=Rec123",
          video: {
            id: 8,
            title: null,
            provider: "youtube",
            source_url: "https://www.youtube.com/watch?v=Rec123",
            thumbnail_url: null,
            duration_seconds: null,
            provider_label: "YouTube",
          },
        },
      ],
    } as TrainingSession);
    renderDetail();

    expect(await screen.findByTitle("Session recording")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/Rec123?start=272&end=378",
    );
    expect(
      screen.getByRole("link", { name: /watch on youtube/i }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=Rec123");
  });

  it("shows the player roster read-only to a player", async () => {
    mockedApi.me.mockResolvedValue(playerUser);
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      training_session_participants: participants,
    });
    renderDetail();

    expect(await screen.findByText(/1\. Maria Silva/)).toBeInTheDocument();
    expect(screen.getByText(/First session back/)).toBeInTheDocument();
    expect(screen.getByText("2 players · 1 invited · 1 confirmed")).toBeInTheDocument();
    // A player cannot change anybody's attendance.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lets a coach mark attendance", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      training_session_participants: participants,
    });
    mockedApi.updateTrainingSession.mockResolvedValue({
      ...fullSession,
      training_session_participants: [
        { ...participants[0], status: "attended" },
        participants[1],
      ],
    });
    renderDetail();
    await screen.findByText(/1\. Maria Silva/);

    await userEvent.selectOptions(
      screen.getByLabelText("Status of Maria Silva"),
      "attended",
    );

    expect(mockedApi.updateTrainingSession).toHaveBeenCalledWith(1, {
      training_session_participants_attributes: [
        { id: 5, status: "attended" },
      ],
    });
    expect(
      await screen.findByText("2 players · 1 confirmed · 1 attended"),
    ).toBeInTheDocument();
  });

  it("reports a failed attendance update", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      training_session_participants: participants,
    });
    mockedApi.updateTrainingSession.mockRejectedValue(
      new Error("API Error: 422"),
    );
    renderDetail();
    await screen.findByText(/1\. Maria Silva/);

    await userEvent.selectOptions(
      screen.getByLabelText("Status of Pedro Santos"),
      "absent",
    );

    expect(await screen.findByText("API Error: 422")).toBeInTheDocument();
  });

  it("flags a private session and states its visibility", async () => {
    mockedApi.trainingSession.mockResolvedValue({
      ...fullSession,
      visibility: "private",
    });
    renderDetail();

    expect(await screen.findByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Visibility: Private")).toBeInTheDocument();
  });
});
