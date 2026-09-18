import type { TrainingSession, TrainingSessionStatus } from "../api";
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
