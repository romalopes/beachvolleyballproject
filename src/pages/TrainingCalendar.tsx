import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, type TrainingSession } from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import {
  addDays,
  addMonths,
  monthGridDays,
  toISODate,
  weekGridDays,
} from "../utils/calendar";
import {
  canManageTrainings,
  dayKey,
  formatTrainingTime,
  sessionsByDay,
  statusLabel,
} from "../utils/training";

type ViewMode = "month" | "week";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TrainingCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTrainings(user);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(
    () => (view === "month" ? monthGridDays(cursor) : weekGridDays(cursor)),
    [view, cursor]
  );
  const rangeKey = `${days[0]?.getTime()}-${days[days.length - 1]?.getTime()}`;

  useEffect(() => {
    let cancelled = false;
    api
      .trainingSessions({
        starts_at_from: toISODate(days[0]),
        starts_at_to: toISODate(addDays(days[days.length - 1], 1)),
      })
      .then((loaded) => {
        if (cancelled) return;
        setSessions(loaded);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load trainings.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Refetch when the visible window changes (tracked via rangeKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const grouped = useMemo(() => sessionsByDay(sessions), [sessions]);

  const title =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `Week of ${cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const goPrev = () => {
    setLoading(true);
    setCursor((current) => (view === "month" ? addMonths(current, -1) : addDays(current, -7)));
  };
  const goNext = () => {
    setLoading(true);
    setCursor((current) => (view === "month" ? addMonths(current, 1) : addDays(current, 7)));
  };
  const goToday = () => {
    setLoading(true);
    setCursor(new Date());
  };


  return (
    <div className="page">
      <PageHeader
        title="Training Calendar"
        description="The shared training schedule. Select an event to open the training details."
      >
        <div className="training-calendar-actions">
          <div className="training-view-toggle" role="tablist" aria-label="Calendar view">
            {(["month", "week"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                className={`filter-btn${view === mode ? " active" : ""}`}
                onClick={() => setView(mode)}
              >
                {mode === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate("/training/new")}
            >
              <Plus size={16} />
              New Training
            </button>
          )}
        </div>
      </PageHeader>

      <div className="training-calendar-nav">
        <button type="button" className="admin-btn" onClick={goPrev} aria-label="Previous">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="admin-btn" onClick={goToday}>
          Today
        </button>
        <button type="button" className="admin-btn" onClick={goNext} aria-label="Next">
          <ChevronRight size={16} />
        </button>
        <h2>{title}</h2>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : error ? (
        <EmptyState title="Could not load trainings" description={error} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No trainings in this period"
          description="Scheduled trainings for the visible dates will appear here."
        />
      ) : (
        <div className={`training-calendar training-calendar-${view}`}>
          <div className="training-calendar-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="training-calendar-grid">
            {days.map((day) => {
              const key = dayKey(day);
              const daySessions = grouped.get(key) ?? [];
              const isToday = dayKey(new Date()) === key;
              const outsideMonth = view === "month" && day.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={`training-calendar-day${isToday ? " today" : ""}${outsideMonth ? " outside-month" : ""}`}
                >
                  <span className="training-calendar-date">{day.getDate()}</span>
                  {daySessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`training-calendar-event status-${session.status}`}
                      onClick={() => navigate(`/training/${session.id}`)}
                    >
                      <span className="training-calendar-event-time">
                        {formatTrainingTime(session.starts_at, session.ends_at)}
                      </span>
                      <span className="training-calendar-event-title">{session.title}</span>
                      <Tag>{statusLabel(session.status)}</Tag>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
