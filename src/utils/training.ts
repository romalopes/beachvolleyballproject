import type {
  ParticipantStatus,
  TrainingSession,
  TrainingSessionParticipant,
  TrainingSessionStatus,
  TrainingSessionVisibility,
} from "../api";
import type { User } from "../api";

/** Managers (coach/curator/admin) see drafts and can create/edit trainings. */
export function canManageTrainings(user: User | null | undefined): boolean {
  return Boolean(
    user?.roles?.some((role) => role === "coach" || role === "curator" || role === "admin")
  );
}

export const TRAINING_STATUSES: { value: TrainingSessionStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export function statusLabel(status: TrainingSessionStatus): string {
  return TRAINING_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Session lengths offered when scheduling a training (the end time is derived). */
export const TRAINING_DURATION_OPTIONS = [
  { value: 30, label: "30min" },
  { value: 60, label: "1hour" },
  { value: 90, label: "1:30h" },
  { value: 120, label: "2:00h" },
] as const;

/** A new training defaults to a 90 minute session. */
export const DEFAULT_TRAINING_DURATION_MINUTES = 90;

/** Lengths offered for a single drill inside a training. */
export const DRILL_DURATION_OPTIONS = [5, 10, 15, 20, 30, 40, 60] as const;

/** "30min" / "1hour" / "1:30h" — a label for any length. */
function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}hour` : `${hours}:${String(rest).padStart(2, "0")}h`;
}

/**
 * The label shown for a session length: the preset's own wording when it is one
 * of the offered sessions, otherwise a formatted one (e.g. 1:45h).
 */
export function trainingDurationLabel(minutes: number): string {
  return (
    TRAINING_DURATION_OPTIONS.find((option) => option.value === minutes)?.label ??
    formatDurationLabel(minutes)
  );
}

/**
 * The offered presets plus the persisted value when it is not one of them, so
 * editing an existing training can never silently rewrite its length.
 */
export function durationChoices(
  presets: readonly number[],
  current?: number | null,
): number[] {
  const values = new Set<number>(presets);
  if (current != null && current > 0) values.add(current);
  return [...values].sort((a, b) => a - b);
}

export function formatTrainingTime(startsAt: string, endsAt: string): string {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${time(startsAt)} – ${time(endsAt)}`;
}

export function formatTrainingDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${date} · ${formatTrainingTime(startsAt, endsAt)}`;
  return `${date} ${formatTrainingTime(startsAt, startsAt)} → ${end.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })} ${new Date(endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Local YYYY-MM-DD key used to group sessions onto calendar days. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function sessionsByDay(sessions: TrainingSession[]): Map<string, TrainingSession[]> {
  const grouped = new Map<string, TrainingSession[]>();
  for (const session of [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = dayKey(new Date(session.starts_at));
    const list = grouped.get(key);
    if (list) list.push(session);
    else grouped.set(key, [session]);
  }
  return grouped;
}

// ---------- Visibility: shared schedule vs private session ----------
/**
 * Visibility choices offered in the training form. "shared" is the published
 * schedule; "private" keeps the session to the people who run trainings (a
 * one-to-one session or a rehab block should not appear in a player's
 * calendar).
 */
export const TRAINING_VISIBILITIES: {
  value: TrainingSessionVisibility;
  label: string;
  hint: string;
}[] = [
  {
    value: "shared",
    label: "Shared",
    hint: "Visible to everyone the schedule is published to.",
  },
  {
    value: "private",
    label: "Private",
    hint: "Only coaches, curators and admins can see this training.",
  },
];

export function visibilityLabel(
  visibility: TrainingSessionVisibility | null | undefined,
): string {
  return (
    TRAINING_VISIBILITIES.find((option) => option.value === visibility)?.label ??
    "Shared"
  );
}

/** Private sessions are worth flagging in the UI — they are the exception. */
export function isPrivateSession(session: {
  visibility?: TrainingSessionVisibility | null;
}): boolean {
  return session.visibility === "private";
}

// ---------- Participants: who is coming, and who showed up ----------
export const PARTICIPANT_STATUSES: {
  value: ParticipantStatus;
  label: string;
}[] = [
  { value: "invited", label: "Invited" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "attended", label: "Attended" },
  { value: "absent", label: "Absent" },
];

export function participantStatusLabel(status: ParticipantStatus): string {
  return (
    PARTICIPANT_STATUSES.find((option) => option.value === status)?.label ??
    status
  );
}

/** "Jane Doe" from a person payload (first name is the only required part). */
export function personName(
  person:
    | { first_name?: string | null; last_name?: string | null }
    | null
    | undefined,
  fallback = "Unnamed person",
): string {
  const name = [person?.first_name, person?.last_name]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return name || fallback;
}

/**
 * Display name of a participant row. The backend computes `player_name`; the
 * nested profile is the fallback for payloads that only carry the association.
 */
export function participantName(
  participant: TrainingSessionParticipant,
): string {
  return (
    participant.player_name?.trim() ||
    personName(
      participant.player_profile?.person,
      `Player #${participant.player_profile_id}`,
    )
  );
}

/**
 * One line for the roster header: "3 players · 2 confirmed · 1 declined". The
 * attendance counts are what a coach looks for at a glance.
 */
export function participantSummary(
  participants: TrainingSessionParticipant[] | undefined | null,
): string {
  const rows = participants ?? [];
  if (rows.length === 0) return "No players added yet";
  const counts = PARTICIPANT_STATUSES.filter((option) =>
    rows.some((row) => row.status === option.value),
  ).map(
    (option) =>
      `${rows.filter((row) => row.status === option.value).length} ${option.label.toLowerCase()}`,
  );
  return [
    `${rows.length} player${rows.length === 1 ? "" : "s"}`,
    ...counts,
  ].join(" · ");
}

/**
 * A participant is either an account holder or a staff-recorded profile: the
 * difference decides whether the player can see their own schedule yet.
 */
export function accountConnectionLabel(
  connected: boolean | null | undefined,
): string | null {
  if (connected == null) return null;
  return connected ? "Account connected" : "No account yet";
}

