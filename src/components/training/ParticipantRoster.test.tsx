import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingSessionParticipant } from "../../api";
import ParticipantRoster from "./ParticipantRoster";

const participant = (
  overrides: Partial<TrainingSessionParticipant> & { id: number },
): TrainingSessionParticipant => ({
  player_profile_id: overrides.id * 10,
  status: "invited",
  notes: null,
  ...overrides,
});

const roster: TrainingSessionParticipant[] = [
  participant({
    id: 1,
    player_name: "Maria Silva",
    status: "confirmed",
    account_connected: true,
  }),
  participant({
    id: 2,
    player_name: "Pedro Santos",
    status: "invited",
    notes: "First session back",
    account_connected: false,
  }),
  participant({
    id: 3,
    player_profile_id: 30,
    status: "attended",
    account_connected: true,
    player_profile: {
      id: 30,
      preferred_position: "blocker",
      level: "advanced",
      person: {
        id: 300,
        first_name: "Ana",
        last_name: "Costa",
        email: null,
        phone: null,
      },
    },
  }),
];

describe("ParticipantRoster", () => {
  it("renders the roster with its summary and account status", () => {
    render(<ParticipantRoster participants={roster} />);

    expect(
      screen.getByText("3 players · 1 invited · 1 confirmed · 1 attended"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Maria Silva/)).toBeInTheDocument();
    expect(screen.getAllByText(/Account connected/)).toHaveLength(2);
    expect(screen.getByText(/No account yet/)).toBeInTheDocument();
    expect(screen.getByText("First session back")).toBeInTheDocument();
  });

  it("falls back to the nested profile for the player name", () => {
    render(<ParticipantRoster participants={roster} />);
    expect(screen.getByText(/Ana Costa/)).toBeInTheDocument();
  });

  it("shows an empty state when nobody is on the roster", () => {
    render(<ParticipantRoster participants={[]} />);
    expect(screen.getByText("No players yet")).toBeInTheDocument();
  });

  it("is read-only without a status handler", () => {
    render(<ParticipantRoster participants={roster} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("marks attendance through the status select", async () => {
    const onStatusChange = vi.fn();
    render(
      <ParticipantRoster
        participants={roster}
        onStatusChange={onStatusChange}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Status of Maria Silva"),
      "attended",
    );

    expect(onStatusChange).toHaveBeenCalledWith(1, "attended");
  });

  it("disables the select while its status is being saved", () => {
    render(
      <ParticipantRoster
        participants={roster}
        savingId={2}
        onStatusChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Status of Pedro Santos")).toBeDisabled();
    expect(screen.getByLabelText("Status of Maria Silva")).toBeEnabled();
  });
});
