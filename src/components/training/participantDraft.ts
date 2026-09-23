import type {
  ParticipantStatus,
  Player,
  TrainingSessionParticipant,
  TrainingSessionParticipantInput,
} from "../../api";
import { personName } from "../../utils/training";

/**
 * A participant row while it is being edited in the training form.
 *
 * Extends the submitted shape with what the UI needs to render a row (a stable
 * React key, a display name and the "no account yet" flag). The payload is built
 * by explicit mapping — as it is for focuses and drills — so nothing here leaks
 * into the request.
 */
export interface ParticipantDraft extends TrainingSessionParticipantInput {
  key: string;
  name: string;
  subtitle?: string | null;
  /** true when submitting this row records a brand-new Person (no account). */
  isNewPerson?: boolean;
}

let participantKey = 0;
const nextParticipantKey = () =>
  `participant-${Date.now()}-${(participantKey += 1)}`;

function createParticipantDraft(
  input: TrainingSessionParticipantInput,
  display: { name: string; subtitle?: string | null; isNewPerson?: boolean },
): ParticipantDraft {
  return { status: "invited", ...input, key: nextParticipantKey(), ...display };
}

/** "Setter · Intermediate" — the player's own summary, when they have one. */
export function playerSubtitle(player: {
  preferred_position?: string | null;
  level?: string | null;
}): string | null {
  const parts = [player.preferred_position, player.level].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** An existing player chosen from the players catalogue. */
export function participantFromPlayer(
  player: Player,
  status: ParticipantStatus = "invited",
): ParticipantDraft {
  return createParticipantDraft(
    { player_profile_id: player.id, status },
    {
      name: player.full_name?.trim() || personName(player.person),
      subtitle: playerSubtitle(player),
      isNewPerson: false,
    },
  );
}

/**
 * A player who has no account yet. The person is submitted inline and the
 * server records Person + PlayerProfile (creation_source: "coach_created") —
 * no Account, so the row shows up as "No account yet".
 */
export function participantFromPerson(
  person: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
  },
  status: ParticipantStatus = "invited",
): ParticipantDraft {
  return createParticipantDraft(
    { person, status },
    { name: personName(person), subtitle: "New player — no account yet", isNewPerson: true },
  );
}

/**
 * Rebuilds the draft list from a persisted session. Rows keep their id so
 * saving updates the participant instead of replacing it (which would discard
 * the attendance a coach already recorded).
 */
export function participantDraftsFromSession(
  participants: TrainingSessionParticipant[] | undefined,
): ParticipantDraft[] {
  return (participants ?? []).map((participant) =>
    createParticipantDraft(
      {
        id: participant.id,
        player_profile_id: participant.player_profile_id,
        status: participant.status,
        notes: participant.notes ?? "",
      },
      {
        name:
          participant.player_name?.trim() ||
          personName(
            participant.player_profile?.person,
            `Player #${participant.player_profile_id}`,
          ),
        subtitle: participant.player_profile
          ? playerSubtitle(participant.player_profile)
          : null,
        isNewPerson: false,
      },
    ),
  );
}

/** A player can only be on the roster once: the database enforces it too. */
export function includesPlayer(
  participants: ParticipantDraft[],
  playerProfileId: number,
): boolean {
  return participants.some(
    (participant) => participant.player_profile_id === playerProfileId,
  );
}
