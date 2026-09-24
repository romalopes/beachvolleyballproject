import { useEffect, useState } from "react";
import type {
  Assessment,
  AssessmentInput,
  AssessmentScale,
  AssessmentStatus,
  AssessmentUpdateInput,
  Coach,
  Skill,
  User,
} from "../../api";
import { ApiValidationError, api } from "../../api";
import { isAssessmentOversight } from "../../utils/assessments";
import { legalValue, toScore } from "../../utils/rating";
import ScoreBadge from "./ScoreBadge";

interface AssessmentFormProps {
  playerProfileId: number;
  user: User | null;
  skills?: Skill[];
  coaches?: Coach[];
  trainingSessionId?: number | null;
  initial?: Assessment | null;
  onSaved: (assessment: Assessment) => void;
  onCancel: () => void;
}

export default function AssessmentForm({
  playerProfileId,
  user,
  skills = [],
  coaches = [],
  trainingSessionId = null,
  initial = null,
  onSaved,
  onCancel,
}: AssessmentFormProps) {
  const [rubricType, setRubricType] = useState<"skill" | "custom">(
    initial?.skill_id ? "skill" : "custom",
  );
  const [skillId, setSkillId] = useState(String(initial?.skill_id ?? ""));
  const [customSkill, setCustomSkill] = useState(initial?.custom_skill ?? "");
  const [scale, setScale] = useState<AssessmentScale>(initial?.scale ?? "one_to_ten");
  const [value, setValue] = useState(String(initial?.reported_value ?? ""));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [coachProfileId, setCoachProfileId] = useState(
    String(initial?.coach_profile_id ?? user?.coach_profile_id ?? ""),
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>(skills);

  useEffect(() => {
    if (skills.length > 0) return;
    let cancelled = false;
    // Keep the custom-rubric path usable when the catalogue request fails.
    const request = typeof api.skills === "function"
      ? api.skills()
      : Promise.resolve([] as Skill[]);
    void request.then((loaded) => {
      if (!cancelled) setAvailableSkills(loaded);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [skills]);

  const numericValue = Number(value);
  const previewScore = legalValue(value, scale) ? toScore(numericValue, scale) : null;
  const oversight = isAssessmentOversight(user);

  const payload = (status?: AssessmentStatus): AssessmentInput | AssessmentUpdateInput => {
    const common: AssessmentUpdateInput = {
      skill_id: rubricType === "skill" ? Number(skillId) : null,
      custom_skill: rubricType === "custom" ? customSkill.trim() : null,
      value: legalValue(value, scale) ? numericValue : null,
      scale,
      notes: notes.trim() || null,
      ...(trainingSessionId != null ? { training_session_id: trainingSessionId } : {}),
      ...(oversight && coachProfileId ? { coach_profile_id: Number(coachProfileId) } : {}),
      ...(status ? { status } : {}),
    };
    return initial
      ? common
      : { ...common, player_profile_id: playerProfileId } as AssessmentInput;
  };

  const save = async (status?: AssessmentStatus) => {
    setError(null);
    if (rubricType === "skill" && !skillId) {
      setError("Choose a skill or describe a custom rubric.");
      return;
    }
    if (rubricType === "custom" && !customSkill.trim()) {
      setError("Describe the custom rubric.");
      return;
    }
    setWorking(true);
    try {
      const saved = initial
        ? await api.updateAssessment(initial.id, payload(status) as AssessmentUpdateInput)
        : await api.createAssessment(payload(status ?? "draft") as AssessmentInput);
      onSaved(saved);
    } catch (err: unknown) {
      setError(
        err instanceof ApiValidationError
          ? err.errors.join(". ")
          : err instanceof Error
            ? err.message
            : "Failed to save the assessment.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <form
      className="admin-form assessment-form"
      aria-label={initial ? "Edit assessment" : "Record assessment"}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset className="assessment-rubric-fields">
        <legend>Rubric</legend>
        <label>
          <input
            type="radio"
            name="assessment-rubric"
            checked={rubricType === "skill"}
            onChange={() => setRubricType("skill")}
          />
          Existing skill
        </label>
        <label>
          <input
            type="radio"
            name="assessment-rubric"
            checked={rubricType === "custom"}
            onChange={() => setRubricType("custom")}
          />
          Custom rubric
        </label>
        {rubricType === "skill" ? (
          <label>
            Skill
            <select value={skillId} onChange={(event) => setSkillId(event.target.value)} required>
              <option value="">Choose a skill</option>
              {availableSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}
            </select>
          </label>
        ) : (
          <label>
            Custom rubric
            <input
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              placeholder="e.g. Serve consistency"
            />
          </label>
        )}
      </fieldset>

      <fieldset className="assessment-rating-fields">
        <legend>Rating</legend>
        <label>
          Scale
          <select value={scale} onChange={(event) => setScale(event.target.value as AssessmentScale)}>
            <option value="one_to_ten">1 to 10</option>
            <option value="one_to_five">1 to 5</option>
          </select>
        </label>
        <label>
          Value
          <input
            type="number"
            min="1"
            max={scale === "one_to_five" ? 5 : 10}
            step="1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Not rated yet"
          />
        </label>
        <div className="assessment-preview">
          <span>Preview</span>
          <ScoreBadge score={previewScore} />
        </div>
      </fieldset>

      {oversight && (
        <label>
          Attributed coach
          <select value={coachProfileId} onChange={(event) => setCoachProfileId(event.target.value)} required>
            <option value="">Choose a coach profile</option>
            {coaches.map((coach) => {
              const name = coach.full_name ?? `${coach.person.first_name} ${coach.person.last_name ?? ""}`.trim();
              return <option key={coach.id} value={coach.id}>{name}{coach.account_status === "profile_only" ? " (profile only)" : ""}</option>;
            })}
          </select>
        </label>
      )}

      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
      </label>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="assessment-form-actions">
        <button type="button" className="admin-btn" disabled={working} onClick={() => void save(initial ? undefined : "draft")}>
          {initial ? "Save" : "Save draft"}
        </button>
        <button type="button" className="admin-btn admin-btn-add" disabled={working} onClick={() => void save("active")}>
          Publish
        </button>
        {initial?.status === "active" && (
          <button type="button" className="admin-btn admin-btn-remove" disabled={working} onClick={() => void save("withdrawn")}>
            Withdraw
          </button>
        )}
        {initial?.status === "withdrawn" && (
          <button type="button" className="admin-btn admin-btn-add" disabled={working} onClick={() => void save("active")}>
            Reinstate
          </button>
        )}
        <button type="button" className="admin-btn" disabled={working} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
