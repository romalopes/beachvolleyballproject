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
