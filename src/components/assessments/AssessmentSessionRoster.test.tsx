import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AssessmentSessionParticipant, Player } from "../../api";
import AssessmentSessionRoster from "./AssessmentSessionRoster";

type ParticipantResult = NonNullable<AssessmentSessionParticipant["result"]>;

const player = (id: number, name: string): Player =>
  ({
    id,
    person_id: id + 100,
    full_name: name,
    preferred_position: null,
    level: null,
    status: "active",
    visibility: "shared",
    created_by: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    person: {
      id: id + 100,
      first_name: name.split(" ")[0],
      last_name: name.split(" ").slice(1).join(" "),
      email: null,
      phone: null,
      date_of_birth: null,
      creation_source: "staff",
    },
  }) as Player;

const participant = (
  id: number,
  playerProfileId: number,
  name: string,
  result?: ParticipantResult,
): AssessmentSessionParticipant => ({
  id,
  player_profile_id: playerProfileId,
  player_name: name,
  inclusion: "included",
  missing_reason: null,
  result,
});

describe("AssessmentSessionRoster search", () => {
  it("searches the server rather than filtering a prefetched page", async () => {
    const user = userEvent.setup();
    const searchPlayers = vi.fn().mockResolvedValue([player(2, "Bruno Alves")]);
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={searchPlayers}
        isDraft
        onAddPlayers={vi.fn()}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Search available players"), "bru");

    await waitFor(() => expect(searchPlayers).toHaveBeenCalledWith("bru"));
    expect(await screen.findByText("Bruno Alves")).toBeInTheDocument();
  });

  it("reports a failed search as a failure, not as 'no players exist'", async () => {
    const user = userEvent.setup();
    const searchPlayers = vi.fn().mockRejectedValue(new Error("API Error: 500"));
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={searchPlayers}
        isDraft
        onAddPlayers={vi.fn()}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Search available players"), "bru");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn't search players/i,
    );
    expect(screen.queryByText(/No players match/i)).not.toBeInTheDocument();
  });

  it("offers a retry after a failed search", async () => {
    const user = userEvent.setup();
    const searchPlayers = vi
      .fn()
      .mockRejectedValueOnce(new Error("API Error: 500"))
      .mockResolvedValueOnce([player(3, "Carla Dias")]);
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={searchPlayers}
        isDraft
        onAddPlayers={vi.fn()}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Search available players"), "car");
    await user.click(await screen.findByText(/try again/i));

    expect(await screen.findByText("Carla Dias")).toBeInTheDocument();
  });

  it("never offers a player who is already on the roster", async () => {
    const user = userEvent.setup();
    const searchPlayers = vi
      .fn()
      .mockResolvedValue([player(1, "Ana Silva"), player(2, "Bruno Alves")]);
    render(
      <AssessmentSessionRoster
        participants={[participant(10, 1, "Ana Silva")]}
        searchPlayers={searchPlayers}
        isDraft
        onAddPlayers={vi.fn()}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Search available players"), "a");

    expect(await screen.findByText("Bruno Alves")).toBeInTheDocument();
    // Scoped to the dropdown: she still appears in the roster list below, which
    // is correct — she must simply not be offered a second time.
    const dropdown = document.querySelector(".session-candidate-dropdown");
    expect(dropdown).toHaveTextContent("Bruno Alves");
    expect(dropdown).not.toHaveTextContent("Ana Silva");
  });

  it("adds an existing player by id", async () => {
    const user = userEvent.setup();
    const onAddPlayers = vi.fn().mockResolvedValue(undefined);
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={vi.fn().mockResolvedValue([player(2, "Bruno Alves")])}
        isDraft
        onAddPlayers={onAddPlayers}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Search available players"), "bru");
    await user.click(await screen.findByRole("button", { name: /add/i }));

    expect(onAddPlayers).toHaveBeenCalledWith([
      { player_profile_id: 2, inclusion: "included" },
    ]);
  });
});


describe("AssessmentSessionRoster inline player creation", () => {
  it("creates a new player from the inline form", async () => {
    const user = userEvent.setup();
    const onAddPlayers = vi.fn().mockResolvedValue(undefined);
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={vi.fn()}
        isDraft
        onAddPlayers={onAddPlayers}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /record a new player/i }));
    await user.type(screen.getByLabelText(/first name/i), "Carla");
    await user.type(screen.getByLabelText(/last name/i), "Dias");
    await user.type(screen.getByLabelText(/email/i), "carla@example.com");
    await user.click(screen.getByRole("button", { name: /create & add player/i }));

    expect(onAddPlayers).toHaveBeenCalledWith([
      {
        person: {
          first_name: "Carla",
          last_name: "Dias",
          email: "carla@example.com",
          phone: null,
        },
        inclusion: "included",
      },
    ]);
  });

  it("requires a first name and sends blanks as null, not empty strings", async () => {
    const user = userEvent.setup();
    const onAddPlayers = vi.fn().mockResolvedValue(undefined);
    render(
      <AssessmentSessionRoster
        participants={[]}
        searchPlayers={vi.fn()}
        isDraft
        onAddPlayers={onAddPlayers}
        onRemovePlayers={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /record a new player/i }));
    await user.click(screen.getByRole("button", { name: /create & add player/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/first name is required/i);
    expect(onAddPlayers).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/first name/i), "  Carla  ");
    await user.click(screen.getByRole("button", { name: /create & add player/i }));

    await waitFor(() => expect(onAddPlayers).toHaveBeenCalled());
    const [entry] = onAddPlayers.mock.calls[0][0];
    expect(entry.person).toEqual({
      first_name: "Carla",
      last_name: null,
      email: null,
      phone: null,
    });
  });

  it("removes a player from a draft roster", async () => {
    const user = userEvent.setup();
    const onRemovePlayers = vi.fn().mockResolvedValue(undefined);
    render(
      <AssessmentSessionRoster
        participants={[participant(10, 1, "Ana Silva")]}
        searchPlayers={vi.fn()}
        isDraft
        onAddPlayers={vi.fn()}
        onRemovePlayers={onRemovePlayers}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove ana silva/i }));
    expect(onRemovePlayers).toHaveBeenCalledWith([1]);
  });

  it("locks the roster once the session is published", () => {
    render(
      <AssessmentSessionRoster
        participants={[participant(10, 1, "Ana Silva")]}
        searchPlayers={vi.fn()}
        isDraft={false}
        onAddPlayers={vi.fn()}
        onRemovePlayers={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Search available players")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove ana silva/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Roster is finalized/i)).toBeInTheDocument();
  });
});
