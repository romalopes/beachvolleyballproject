import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  ApiValidationError,
  type Category,
  type Drill,
  type Skill,
  type TrainingSession,
  type TrainingSessionInput,
  type TrainingSessionStatus,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import TrainingDrillList from "../components/training/TrainingDrillList";
import TrainingFocusList from "../components/training/TrainingFocusList";
import DrillSelector, {
  type DrillDraft,
} from "../components/training/DrillSelector";
import SkillFocusSelector from "../components/training/SkillFocusSelector";
import {
  createCustomFocus,
  createSkillFocus,
  type FocusDraft,
} from "../components/training/focusDraft";
import {
  canManageTrainings,
  DEFAULT_TRAINING_DURATION_MINUTES,
  durationChoices,
  TRAINING_DURATION_OPTIONS,
  TRAINING_STATUSES,
  trainingDurationLabel,
} from "../utils/training";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** Turns a local "YYYY-MM-DDTHH:mm" start plus a length into the session end. */
function addMinutes(localValue: string, minutes: number): string {
  return new Date(new Date(localValue).getTime() + minutes * 60_000).toISOString();
}

const emptyPreviewRow = (index: number) => ({ id: index });

export default function TrainingFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const invalidId = !isNew && (id === "new" || Number.isNaN(Number(id)));
  const sessionId = isNew || invalidId ? null : Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTrainings(user);

  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(
    DEFAULT_TRAINING_DURATION_MINUTES,
  );
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<TrainingSessionStatus>("draft");
  const [focuses, setFocuses] = useState<FocusDraft[]>([]);
  const [selectedDrills, setSelectedDrills] = useState<DrillDraft[]>([]);
  const [originalFocusIds, setOriginalFocusIds] = useState<number[]>([]);
  const [originalDrillIds, setOriginalDrillIds] = useState<number[]>([]);

  const [loadingSession, setLoadingSession] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.categories(), api.skills(), api.drills()])
      .then(([cats, sks, drs]) => {
        if (cancelled) return;
        setCategories(cats);
        setSkills(sks);
        setDrills(drs);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setReferenceError(
          err instanceof Error ? err.message : "Failed to load catalogue.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew || invalidId || sessionId == null) return;
    let cancelled = false;
    api
      .trainingSession(sessionId)
      .then((session: TrainingSession) => {
        if (cancelled) return;
        setTitle(session.title);
        setDescription(session.description ?? "");
        const startLocal = toLocalInput(session.starts_at);
        setDate(startLocal.slice(0, 10));
        setStartTime(startLocal.slice(11, 16));
        // The form edits the session length, not its end time. Deriving it keeps
        // a session that is not one of the presets (e.g. 1:45h) intact.
        const loadedMinutes = Math.round(
          (new Date(session.ends_at).getTime() -
            new Date(session.starts_at).getTime()) /
            60_000,
        );
        setDurationMinutes(
          Number.isFinite(loadedMinutes) && loadedMinutes > 0
            ? loadedMinutes
            : DEFAULT_TRAINING_DURATION_MINUTES,
        );
        setLocation(session.location ?? "");
        setStatus(session.status);
        const orderedFocuses = [...(session.training_focuses ?? [])].sort(
          (a, b) => a.position - b.position,
        );
        setFocuses(
          orderedFocuses.map((focus) =>
            focus.skill_id
              ? createSkillFocus(
                  focus.skill_id,
                  focus.description ?? "",
                  focus.id,
                )
              : createCustomFocus(
                  focus.custom_focus ?? "",
                  focus.description ?? "",
                  focus.id,
                ),
          ),
        );
        setOriginalFocusIds(orderedFocuses.map((focus) => focus.id));
        const orderedDrills = [...(session.training_session_drills ?? [])].sort(
          (a, b) => a.position - b.position,
        );
        setSelectedDrills(
          orderedDrills
            .filter((row) => row.drill)
            .map((row) => ({
              key: `drill-${row.id}`,
              id: row.id,
              drill_id: row.drill_id,
              drill: row.drill!,
              duration_minutes: row.duration_minutes,
              notes: row.notes ?? "",
            })),
        );
        setOriginalDrillIds(orderedDrills.map((row) => row.id));
        setLoadingSession(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load training.",
        );
        setLoadingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, invalidId, sessionId]);

  const focusSkillIds = useMemo(
    () =>
      focuses
        .map((focus) => focus.skill_id)
        .filter((skillId): skillId is number => skillId != null),
    [focuses],
  );

  const focusSkillNames = useMemo(() => {
    const byId = new Map(skills.map((skill) => [skill.id, skill.title]));
    return focusSkillIds.map((skillId) => byId.get(skillId) ?? "Unknown skill");
  }, [focusSkillIds, skills]);

  // Presets plus the loaded value, so saving never rewrites a custom length.
  const durationOptions = useMemo(
    () =>
      durationChoices(
        TRAINING_DURATION_OPTIONS.map((option) => option.value),
        durationMinutes,
      ),
    [durationMinutes],
  );

  const previewSession: TrainingSession = useMemo(
    () => ({
      id: sessionId ?? 0,
      title: title.trim() || "Untitled training",
      description: description.trim() || null,
      starts_at:
        date && startTime
          ? fromLocalInput(`${date}T${startTime}`)
          : new Date().toISOString(),
      ends_at:
        date && startTime
          ? addMinutes(`${date}T${startTime}`, durationMinutes)
          : new Date().toISOString(),
      location: location.trim() || null,
      status,
      created_by_id: null,
      training_focuses: focuses.map((focus, index) => ({
        ...emptyPreviewRow(index),
        skill_id: focus.skill_id ?? null,
        custom_focus: focus.skill_id ? null : (focus.custom_focus ?? null),
        description: focus.description?.trim()
          ? focus.description.trim()
          : null,
        position: index + 1,
        label: focus.skill_id
          ? (skills.find((skill) => skill.id === focus.skill_id)?.title ??
            "Skill focus")
          : (focus.custom_focus ?? "Custom focus"),
        skill: (() => {
          if (!focus.skill_id) return null;
          const skill = skills.find((s) => s.id === focus.skill_id);
          if (!skill) return null;
          return {
            id: skill.id,
            title: skill.title,
            slug: skill.slug,
            description: skill.description,
            category: categories.find(
              (category) => category.id === skill.category_id,
            ),
          };
        })(),
      })),
      training_session_drills: selectedDrills.map((row, index) => ({
        ...emptyPreviewRow(index),
        drill_id: row.drill_id ?? row.drill.id,
        position: index + 1,
        duration_minutes: row.duration_minutes ?? null,
        notes: row.notes?.trim() ? row.notes.trim() : null,
        drill: row.drill,
      })),
    }),
    [
      sessionId,
      title,
      description,
      date,
      startTime,
      durationMinutes,
      location,
      status,
      focuses,
      selectedDrills,
      skills,
      categories,
    ],
  );

  if (!canManage) {
    return (
      <div className="page">
        <PageHeader title={isNew ? "New Training" : "Edit Training"} />
        <EmptyState
          title="Not authorized"
          description="Only coaches, curators and admins can manage training sessions."
        />
      </div>
    );
  }

  if (invalidId) {
    return (
      <div className="page">
        <PageHeader title="Edit Training" />
        <EmptyState title="Training session not found" />
      </div>
    );
  }

  if (loadingSession) return <div className="loading">Loading...</div>;
  if (loadError)
    return (
      <EmptyState title="Training session not found" description={loadError} />
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);
    if (!title.trim()) {
      setErrors(["Title is required."]);
      return;
    }
    if (!date || !startTime) {
      setErrors(["Date and start time are required."]);
      return;
    }
    const startsAt = fromLocalInput(`${date}T${startTime}`);
    const endsAt = addMinutes(`${date}T${startTime}`, durationMinutes);
    const removedFocusIds = originalFocusIds.filter(
      (id) => !focuses.some((focus) => focus.id === id),
    );
    const removedDrillIds = originalDrillIds.filter(
      (id) => !selectedDrills.some((row) => row.id === id),
    );
    const payload: TrainingSessionInput = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: location.trim() || null,
      status,
      training_focuses_attributes: [
        ...focuses.map((focus, index) => ({
          id: focus.id,
          skill_id: focus.skill_id ?? null,
          custom_focus: focus.skill_id
            ? null
            : focus.custom_focus?.trim() || null,
          description: focus.description?.trim()
            ? focus.description.trim()
            : null,
          position: index + 1,
        })),
        ...removedFocusIds.map((id) => ({ id, _destroy: true })),
      ],
      training_session_drills_attributes: [
        ...selectedDrills.map((row, index) => ({
          id: row.id,
          drill_id: row.drill_id ?? row.drill.id,
          position: index + 1,
          duration_minutes: row.duration_minutes ?? null,
          notes: row.notes?.trim() ? row.notes.trim() : null,
        })),
        ...removedDrillIds.map((id) => ({ id, _destroy: true })),
      ],
    };
    setSaving(true);
    try {
      const saved = isNew
        ? await api.createTrainingSession(payload)
        : await api.updateTrainingSession(sessionId!, payload);
      navigate(`/training/${saved.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiValidationError) {
        setErrors(err.errors);
      } else {
        setErrors([
          err instanceof Error ? err.message : "Failed to save training.",
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={isNew ? "New Training" : "Edit Training"}
        description="Define the session, its focuses and its drills. The preview below updates as you type."
      />
      {referenceError && <div className="admin-error">{referenceError}</div>}
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="training-editor-section">
          <h3>Basic Information</h3>
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Serve Reception Training"
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>
          <div className="training-datetime-row">
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Start time
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <label>
              Duration
              <select
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(Number(event.target.value))
                }
              >
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {trainingDurationLabel(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Location
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Coogee Beach"
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as TrainingSessionStatus)
              }
            >
              {TRAINING_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SkillFocusSelector
          categories={categories}
          skills={skills}
          focuses={focuses}
          onChange={setFocuses}
        />

        <DrillSelector
          skills={skills}
          drills={drills}
          focusSkillIds={focusSkillIds}
          focusSkillNames={focusSkillNames}
          selected={selectedDrills}
          onChange={setSelectedDrills}
        />

        {errors.length > 0 && (
          <div className="admin-error">
            <ul>
              {errors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-btn admin-btn-add"
            disabled={saving}
          >
            {saving ? "Saving..." : isNew ? "Create Training" : "Save Changes"}
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() =>
              navigate(isNew ? "/training" : `/training/${sessionId}`)
            }
          >
            Cancel
          </button>
        </div>
      </form>

      <section className="detail-section">
        <h2>Preview</h2>
        <TrainingFocusList focuses={previewSession.training_focuses} />
        <TrainingDrillList drills={previewSession.training_session_drills} />
      </section>
    </div>
  );
}
