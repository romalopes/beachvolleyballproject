import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { api, type TrainingSession } from "../api";
import Schedule from "./Schedule";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      trainingSessions: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const playerUser = {
  id: 1,
  name: "Player",
  email_address: "player@x.com",
  roles: ["player"],
};

const session = (overrides: Partial<TrainingSession>): TrainingSession => ({
  id: 1,
  title: "Morning Session",
  description: null,
  starts_at: "2026-09-21T09:00:00.000Z",
  ends_at: "2026-09-21T11:00:00.000Z",
  location: "Coogee Beach",
  status: "scheduled",
  visibility: "shared",
  created_by_id: 2,
  ...overrides,
});

const renderSchedule = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Schedule />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(playerUser);
  mockedApi.trainingSessions.mockResolvedValue([session({})]);
});

afterEach(() => vi.clearAllMocks());

describe("Schedule — my schedule", () => {
  it("loads the shared schedule first", async () => {
    renderSchedule();

    expect(await screen.findByText("Morning Session")).toBeInTheDocument();
    expect(mockedApi.trainingSessions).toHaveBeenCalledWith({ mine: false });
  });

  it("refetches with mine=1 for the signed-in player", async () => {
    renderSchedule();
    await screen.findByText("Morning Session");

    mockedApi.trainingSessions.mockResolvedValue([
      session({ id: 7, title: "My Own Session" }),
    ]);
    await userEvent.click(
      screen.getByRole("checkbox", { name: /My schedule only/ }),
    );

    expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith({ mine: true });
    expect(await screen.findByText("My Own Session")).toBeInTheDocument();
  });

  it("explains an empty personal schedule", async () => {
    mockedApi.trainingSessions.mockResolvedValue([]);
    renderSchedule();
    await screen.findByText("No scheduled sessions");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /My schedule only/ }),
    );

    expect(mockedApi.trainingSessions).toHaveBeenLastCalledWith({ mine: true });
    expect(
      await screen.findByText("No sessions for you yet"),
    ).toBeInTheDocument();
  });

  it("flags a private session", async () => {
    mockedApi.trainingSessions.mockResolvedValue([
      session({ visibility: "private", title: "One-to-one block work" }),
    ]);
    renderSchedule();

    expect(await screen.findByText("One-to-one block work")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
  });
});
