import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Player } from "../../api";
import ParticipantSelector from "./ParticipantSelector";
import type { ParticipantDraft } from "./participantDraft";

const player = (overrides: Partial<Player> & { id: number }): Player => ({
  person_id: overrides.id * 10,
  preferred_position: null,
  level: null,
  status: "active",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  person: {
    id: overrides.id * 10,
    first_name: "Player",
    last_name: String(overrides.id),
    email: null,
    phone: null,
    date_of_birth: null,
    creation_source: "coach_created",
  },
  ...overrides,
});

const players: Player[] = [
  player({
    id: 1,
    full_name: "Maria Silva",
    preferred_position: "setter",
    level: "intermediate",
    account_status: "connected",
    person: {
      id: 10,
      first_name: "Maria",
      last_name: "Silva",
      email: "maria@example.com",
      phone: null,
      date_of_birth: null,
      creation_source: "signup",
    },
  }),
  player({
    id: 2,
    full_name: "Pedro Santos",
    account_status: "profile_only",
    person: {
      id: 20,
      first_name: "Pedro",
      last_name: "Santos",
      email: "pedro@example.com",
      phone: null,
      date_of_birth: null,
      creation_source: "coach_created",
    },
  }),
];

/** Mirrors how the training form owns the draft list. */
function Harness({ catalogue = players }: { catalogue?: Player[] }) {
  const [selected, setSelected] = useState<ParticipantDraft[]>([]);
  return (
    <>
      <ParticipantSelector
        players={catalogue}
        selected={selected}
        onChange={setSelected}
      />
      <output data-testid="draft-state">
        {JSON.stringify(
          selected.map((draft) => ({ ...draft, key: undefined })),
        )}
      </output>
    </>
  );
}

const draftState = () =>
  JSON.parse(screen.getByTestId("draft-state").textContent ?? "[]") as Record<
    string,
    unknown
  >[];

const roster = () =>
  within(screen.getByRole("group", { name: "Players" }));

describe("ParticipantSelector", () => {
  it("adds an existing player and removes them from the candidates", async () => {
    render(<Harness />);

    await userEvent.click(
      roster().getByRole("button", {
        name: "Add Maria Silva to the session",
      }),
    );

    expect(draftState()).toHaveLength(1);
    expect(draftState()[0]).toMatchObject({
      player_profile_id: 1,
      status: "invited",
    });
    // The chosen player leaves the candidate list: only Pedro's Add remains.
    expect(roster().getAllByRole("button", { name: /^Add .* to the session$/ }))
      .toHaveLength(1);
    expect(roster().getByText(/1\. Maria Silva/)).toBeInTheDocument();
    expect(roster().getByText(/setter · intermediate/)).toBeInTheDocument();
  });

  it("shows a player with no account as profile only", () => {
    render(<Harness />);
    expect(roster().getByText("No account")).toBeInTheDocument();
  });

  it("filters candidates by name or email", async () => {
    render(<Harness />);

    await userEvent.type(roster().getByLabelText("Search players"), "pedro");

    expect(roster().getByText(/Pedro Santos/)).toBeInTheDocument();
    expect(roster().queryByText(/Maria Silva/)).not.toBeInTheDocument();
  });

  it("records a player who has no account yet", async () => {
    render(<Harness />);

    await userEvent.click(
      roster().getByRole("button", { name: /Record a new player/ }),
    );
    await userEvent.type(
      roster().getByLabelText("First name"),
      "Novo",
    );
    await userEvent.type(roster().getByLabelText("Email"), "novo@example.com");
    await userEvent.click(
      roster().getByRole("button", { name: "Add player" }),
    );

    expect(roster().getByText(/New player — no account yet/)).toBeInTheDocument();
    expect(draftState()[0]).toMatchObject({
      person: {
        first_name: "Novo",
        email: "novo@example.com",
      },
      status: "invited",
    });
  });

  it("requires a name before recording a new player", async () => {
    render(<Harness />);

    await userEvent.click(
      roster().getByRole("button", { name: /Record a new player/ }),
    );
    await userEvent.click(
      roster().getByRole("button", { name: "Add player" }),
    );

    expect(
      screen.getByText("A first name is required to record a new player."),
    ).toBeInTheDocument();
    expect(draftState()).toHaveLength(0);
  });

  it("updates a participant status and notes", async () => {
    render(<Harness />);
    await userEvent.click(
      roster().getByRole("button", {
        name: "Add Maria Silva to the session",
      }),
    );

    await userEvent.selectOptions(
      roster().getByLabelText("Participant 1 status"),
      "confirmed",
    );
    await userEvent.type(
      roster().getByLabelText("Participant 1 notes"),
      "Left knee taped",
    );

    expect(draftState()[0]).toMatchObject({
      status: "confirmed",
      notes: "Left knee taped",
    });
  });

  it("reorders and removes participants", async () => {
    render(<Harness />);
    await userEvent.click(
      roster().getByRole("button", { name: "Add Maria Silva to the session" }),
    );
    await userEvent.click(
      roster().getByRole("button", { name: "Add Pedro Santos to the session" }),
    );

    await userEvent.click(
      roster().getByRole("button", { name: "Move participant 2 up" }),
    );
    expect(draftState().map((draft) => draft.player_profile_id)).toEqual([2, 1]);

    await userEvent.click(
      roster().getByRole("button", { name: "Remove participant 1" }),
    );
    expect(draftState().map((draft) => draft.player_profile_id)).toEqual([1]);
  });
});
