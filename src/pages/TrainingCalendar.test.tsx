import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { api, type TrainingSession } from "../api";
import TrainingCalendar from "./TrainingCalendar";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { me: vi.fn(), trainingSessions: vi.fn() },
  };
});

const mockedApi = vi.mocked(api, true);
const playerUser = { id: 1, name: "Player", email_address: "p@x.com", roles: ["player"] };
const coachUser = { id: 2, name: "Coach", email_address: "c@x.com", roles: ["coach"] };

function isoOnToday(hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString();
}

const session = (overrides: Partial<TrainingSession>): TrainingSession =>
  ({
    id: 1,
    title: "Morning Session",
    description: null,
    starts_at: isoOnToday(9),
    ends_at: isoOnToday(11),
    location: "Coogee Beach",
    status: "scheduled",
    ...overrides,
  }) as TrainingSession;

const renderCalendar = () =>
  render(
    <MemoryRouter initialEntries={["/calendar"]}>
      <AuthProvider>
        <Routes>
          <Route path="/calendar" element={<TrainingCalendar />} />
          <Route path="/training/:id" element={<div>Training detail page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(playerUser);
});

afterEach(cleanup);

describe("TrainingCalendar", () => {
  it("shows trainings on the correct date with time and status", async () => {
    mockedApi.trainingSessions.mockResolvedValue([
      session({}),
      session({ id: 2, title: "Cancelled Session", status: "cancelled" }),
    ]);
    renderCalendar();

    expect(await screen.findByText("Morning Session")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Session")).toBeInTheDocument();
    expect(screen.getAllByText(/9:00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith(
      expect.objectContaining({ starts_at_from: expect.any(String), starts_at_to: expect.any(String) })
    );
  });

  it("opens the training detail page when an event is clicked", async () => {
    mockedApi.trainingSessions.mockResolvedValue([session({})]);
    const user = userEvent.setup();
    renderCalendar();

    await user.click(await screen.findByText("Morning Session"));
    expect(await screen.findByText("Training detail page")).toBeInTheDocument();
  });

  it("toggles between month and week views", async () => {
    mockedApi.trainingSessions.mockResolvedValue([session({})]);
    const user = userEvent.setup();
    renderCalendar();
    await screen.findByText("Morning Session");

    await user.click(screen.getByRole("tab", { name: "Week" }));
    expect(screen.getByText(/Week of /)).toBeInTheDocument();
    const calendar = document.querySelector(".training-calendar-week");
    expect(calendar).not.toBeNull();
    expect(within(calendar as HTMLElement).getByText("Morning Session")).toBeInTheDocument();
  });

  it("shows New Training only to managers", async () => {
    mockedApi.trainingSessions.mockResolvedValue([session({})]);
    renderCalendar();
    await screen.findByText("Morning Session");
    expect(screen.queryByRole("button", { name: /new training/i })).not.toBeInTheDocument();
    cleanup();

    mockedApi.me.mockResolvedValue(coachUser);
    renderCalendar();
    await screen.findByText("Morning Session");
    expect(screen.getByRole("button", { name: /new training/i })).toBeInTheDocument();
  });
});
