import { useEffect, useState } from "react";
import { api, type Drill } from "../../../../api";
import {
  TRAINING_STAGES,
  DIFFICULTY_LEVELS,
  isValidDrillRange,
} from "../../../../utils/drills";

export interface DrillFormValues {
  title: string;
  setup_instructions: string;
  training_stage: string;
  difficulty_level: string;
  min_players: string;
  max_players: string;
  ideal_num_players: string;
}

interface DrillFormProps {
  initial?: Drill | null;
  onSuccess: (drill: Drill) => void;
  onCancel: () => void;
}

const EMPTY: DrillFormValues = {
  title: "",
  setup_instructions: "",
  training_stage: "",
  difficulty_level: "",
  min_players: "",
  max_players: "",
  ideal_num_players: "",
};

export default function DrillForm({ initial, onSuccess, onCancel }: DrillFormProps) {
  const [values, setValues] = useState<DrillFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setValues({
        title: initial.title,
        setup_instructions: initial.setup_instructions ?? "",
        training_stage: initial.training_stage,
        difficulty_level: initial.difficulty_level,
        min_players: String(initial.min_players),
        max_players: String(initial.max_players),
        ideal_num_players: String(initial.ideal_num_players),
      });
    }
  }, [initial]);

  const set = (key: keyof DrillFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!values.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!values.training_stage) {
      setError("Training stage is required.");
      return;
    }
    if (!values.difficulty_level) {
      setError("Difficulty level is required.");
      return;
    }

    const min = Number(values.min_players);
    const max = Number(values.max_players);
    const ideal = Number(values.ideal_num_players);

    if (
      !isValidDrillRange({
        min_players: values.min_players === "" ? NaN : min,
        max_players: values.max_players === "" ? NaN : max,
        ideal_num_players: values.ideal_num_players === "" ? NaN : ideal,
        training_stage: values.training_stage,
        difficulty_level: values.difficulty_level,
      })
    ) {
      setError("Player counts must be positive integers with min ≤ ideal ≤ max.");
      return;
    }

    const payload = {
      title: values.title.trim(),
      setup_instructions: values.setup_instructions.trim() || null,
      training_stage: values.training_stage,
      difficulty_level: values.difficulty_level,
      min_players: min,
      max_players: max,
      ideal_num_players: ideal,
    };

    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateDrill(initial.id, payload)
        : await api.adminCreateDrill(payload);
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save drill.");
    } finally {
      setSaving(false);
    }
  };

  return <DrillFormFields values={values} set={set} error={error} saving={saving} isNew={!initial} onCancel={onCancel} onSubmit={handleSubmit} />;
}

/* __FIELDS__ */
function DrillFormFields({
  values,
  set,
  error,
  saving,
  isNew,
  onCancel,
  onSubmit,
}: {
  values: DrillFormValues;
  set: (key: keyof DrillFormValues, value: string) => void;
  error: string | null;
  saving: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="admin-form">
      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      <div className="admin-field">
        <label htmlFor="drill-title">Title *</label>
        <input
          id="drill-title"
          type="text"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Target Serving"
          maxLength={255}
        />
      </div>

      <div className="admin-field">
        <label htmlFor="drill-setup">Setup Instructions</label>
        <textarea
          id="drill-setup"
          value={values.setup_instructions}
          onChange={(e) => set("setup_instructions", e.target.value)}
          placeholder="How to set up and run this drill..."
          rows={5}
        />
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="drill-stage">Training Stage *</label>
          <select id="drill-stage" value={values.training_stage} onChange={(e) => set("training_stage", e.target.value)}>
            <option value="">Select a stage</option>
            {TRAINING_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="drill-difficulty">Difficulty *</label>
          <select id="drill-difficulty" value={values.difficulty_level} onChange={(e) => set("difficulty_level", e.target.value)}>
            <option value="">Select a level</option>
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label htmlFor="drill-min">Min Players *</label>
          <input id="drill-min" type="number" min={1} value={values.min_players} onChange={(e) => set("min_players", e.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="drill-max">Max Players *</label>
          <input id="drill-max" type="number" min={1} value={values.max_players} onChange={(e) => set("max_players", e.target.value)} />
        </div>
        <div className="admin-field">
          <label htmlFor="drill-ideal">Ideal Players *</label>
          <input id="drill-ideal" type="number" min={1} value={values.ideal_num_players} onChange={(e) => set("ideal_num_players", e.target.value)} />
        </div>
      </div>

      <div className="admin-form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : isNew ? "Create Drill" : "Update Drill"}
        </button>
      </div>
    </form>
  );
}
