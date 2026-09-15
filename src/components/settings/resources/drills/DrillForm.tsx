import { useEffect, useMemo, useState } from "react";
import { api, ApiValidationError, type Category, type Drill, type Skill } from "../../../../api";
import type { DrillDefinition } from "../../../drill/definition";
import {
  TRAINING_STAGES,
  DIFFICULTY_LEVELS,
  isValidDrillRange,
} from "../../../../utils/drills";
import {
  mapServerErrors,
  parseAndValidateDefinition,
  type DrillSchemaIssue,
} from "../../../../services/drillSchema";
import DrillDefinitionEditor from "./DrillDefinitionEditor";
import EntityCatalog from "./EntityCatalog";
import {
  EMPTY_DEFINITION,
  definitionToJsonText,
  jsonTextToDefinition,
} from "./drill-model";

export interface DrillFormValues {
  title: string;
  setup_instructions: string;
  training_stage: string;
  difficulty_level: string;
  min_players: string;
  max_players: string;
  ideal_num_players: string;
  /**
   * Raw JSON text for the definition column; `""` means "no definition".
   * The `DrillDefinition` model is derived from this text (see `definition`),
   * so malformed input the user is still typing stays visible in the textarea.
   */
  jsonText: string;
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
  jsonText: "",
};

export default function DrillForm({ initial, onSuccess, onCancel }: DrillFormProps) {
  const [values, setValues] = useState<DrillFormValues>(EMPTY);
  /**
   * The shared `DrillDefinition` model. `values.jsonText` is the JSON buffer the
   * textarea shows: a visual edit makes the model win and re-derives the text
   * ("the JSON on time"), while a JSON edit keeps the raw text verbatim and only
   * rehydrates the model when the text parses.
   */
  const [definition, setDefinition] = useState<DrillDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<number | "all">("all");
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [serverFeedback, setServerFeedback] = useState<{
    definition: string;
    issues: DrillSchemaIssue[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .skills()
      .then((items) => {
        if (!cancelled) setAvailableSkills(items);
      })
      .catch(console.error);
    api
      .categories()
      .then((items) => {
        if (!cancelled) setAvailableCategories(items);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initial) {
      const initialDefinition = initial.definition ?? null;
      setValues({
        title: initial.title,
        setup_instructions: initial.setup_instructions ?? "",
        training_stage: initial.training_stage,
        difficulty_level: initial.difficulty_level,
        min_players: String(initial.min_players),
        max_players: String(initial.max_players),
        ideal_num_players: String(initial.ideal_num_players),
        jsonText: initialDefinition ? definitionToJsonText(initialDefinition) : "",
      });
      setDefinition(initialDefinition);
      setSelectedSkillIds((initial.skills ?? []).map((s) => s.id));
      setSkillsError(null);
    } else {
      setValues(EMPTY);
      setDefinition(null);
      setSelectedSkillIds([]);
      setSkillsError(null);
    }
  }, [initial]);

  const set = (key: keyof DrillFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  /** Visual edit: model → JSON text. */
  const applyDefinition = (next: DrillDefinition) => {
    setDefinition(next);
    setValues((prev) => ({ ...prev, jsonText: definitionToJsonText(next) }));
  };

  /** JSON edit: text → model when it parses; malformed text leaves the model. */
  const applyJsonText = (text: string) => {
    setValues((prev) => ({ ...prev, jsonText: text }));
    const parsed = jsonTextToDefinition(text);
    if (parsed !== null) setDefinition(parsed);
  };

  const toggleSkill = (id: number) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
    setSkillsError(null);
  };

  // Live feedback while typing: parse + schema-check the definition text.
  const parseResult = useMemo(
    () => parseAndValidateDefinition(values.jsonText),
    [values.jsonText],
  );

  /** Pretty-print the JSON in place; a no-op when the text is malformed/blank. */
  const formatDefinition = () => {
    if (parseResult.parseError !== null) return;
    const parsed = parseResult.definition;
    if (parsed === null) return;
    applyDefinition(parsed as DrillDefinition);
  };

  // Server-reported issues are stored with the definition text they were
  // reported for, so they go stale (and disappear) as soon as the user edits
  // the definition — no synchronising effect required.
  const serverIssues =
    serverFeedback && serverFeedback.definition === values.jsonText
      ? serverFeedback.issues
      : [];

  // Prefer authoritative server feedback when present; otherwise show the
  // live client-side schema issues for the text currently in the editor.
  const displayIssues =
    serverIssues.length > 0 ? serverIssues : parseResult.issues;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setServerFeedback(null);
    setSkillsError(null);

    if (selectedSkillIds.length === 0) {
      setSkillsError("Please select at least one skill.");
      return;
    }

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

    // Client-side pre-check against the shared v1 schema. Blank definitions are
    // allowed (Rails skips validation for them). Rails remains the authority.
    if (!parseResult.valid) {
      setError(
        parseResult.parseError
          ? "Definition is not valid JSON."
          : "Definition does not satisfy the v1 schema. See the issues below.",
      );
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
      definition: parseResult.definition as DrillDefinition | null,
      skill_ids: selectedSkillIds,
    };

    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateDrill(initial.id, payload)
        : await api.adminCreateDrill(payload);
      onSuccess(saved);
    } catch (err) {
      if (err instanceof ApiValidationError) {
        // Rails is the authority: surface its errors in the same issue list,
        // tagged with the definition text they apply to.
        setServerFeedback({
          definition: values.jsonText,
          issues: mapServerErrors(err.errors),
        });
      }
      setError(err instanceof Error ? err.message : "Failed to save drill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrillFormFields
      values={values}
      set={set}
      definition={definition}
      onDefinitionChange={applyDefinition}
      onJsonTextChange={applyJsonText}
      error={error}
      saving={saving}
      isNew={!initial}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      parseError={parseResult.parseError}
      issues={displayIssues}
      onFormat={formatDefinition}
      availableSkills={availableSkills}
      availableCategories={availableCategories}
      skillCategoryFilter={skillCategoryFilter}
      onSkillCategoryChange={setSkillCategoryFilter}
      selectedSkillIds={selectedSkillIds}
      skillsError={skillsError}
      onToggleSkill={toggleSkill}
    />
  );
}

/* __FIELDS__ */
function DrillFormFields({
  values,
  set,
  definition,
  onDefinitionChange,
  onJsonTextChange,
  error,
  saving,
  isNew,
  onCancel,
  onSubmit,
  parseError,
  issues,
  onFormat,
  availableSkills,
  availableCategories,
  skillCategoryFilter,
  onSkillCategoryChange,
  selectedSkillIds,
  skillsError,
  onToggleSkill,
}: {
  values: DrillFormValues;
  set: (key: keyof DrillFormValues, value: string) => void;
  definition: DrillDefinition | null;
  onDefinitionChange: (next: DrillDefinition) => void;
  onJsonTextChange: (text: string) => void;
  error: string | null;
  saving: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  parseError: string | null;
  issues: DrillSchemaIssue[];
  onFormat: () => void;
  availableSkills: Skill[];
  availableCategories: Category[];
  skillCategoryFilter: number | "all";
  onSkillCategoryChange: (value: number | "all") => void;
  selectedSkillIds: number[];
  skillsError: string | null;
  onToggleSkill: (id: number) => void;
}) {
  const filteredSkills =
    skillCategoryFilter === "all"
      ? availableSkills
      : availableSkills.filter((skill) => skill.category_id === skillCategoryFilter);
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

      <div className="admin-field">
        <span id="drill-skills-label">Skills * (select at least one)</span>
        <div className="filter-select-group drill-skills-category">
          <label htmlFor="drill-skill-category">Category:</label>
          <select
            id="drill-skill-category"
            value={skillCategoryFilter}
            onChange={(e) =>
              onSkillCategoryChange(e.target.value === "all" ? "all" : Number(e.target.value))
            }
          >
            <option value="all">All Categories</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {skillsError && (
          <div className="auth-flash auth-flash-error" role="alert">
            {skillsError}
          </div>
        )}
        <div
          className="drill-skills-picker"
          role="group"
          aria-labelledby="drill-skills-label"
        >
          {availableSkills.length === 0 ? (
            <p className="drill-skills-empty">No skills available.</p>
          ) : filteredSkills.length === 0 ? (
            <p className="drill-skills-empty">No skills in this category.</p>
          ) : (
            filteredSkills.map((skill) => {
              const checked = selectedSkillIds.includes(skill.id);
              return (
                <label key={skill.id} className="drill-skill-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSkill(skill.id)}
                  />
                  <span>
                    {skill.title}
                    {skill.category ? ` (${skill.category.name})` : ""}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {selectedSkillIds.length > 0 && (
          <>
            <p className="drill-skills-count">
              {selectedSkillIds.length} skill{selectedSkillIds.length === 1 ? "" : "s"} selected
            </p>
            <ul className="drill-skills-selected" aria-label="Selected skills">
              {selectedSkillIds.map((id) => {
                const skill = availableSkills.find((s) => s.id === id);
                const label = skill
                  ? `${skill.title}${skill.category ? ` (${skill.category.name})` : ""}`
                  : `Skill #${id}`;
                return (
                  <li key={id} className="drill-skill-chip">
                    <span>{label}</span>
                    <button
                      type="button"
                      className="drill-skill-remove"
                      onClick={() => onToggleSkill(id)}
                      aria-label={`Remove ${label}`}
                      title={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <EntityCatalog
        definition={definition ?? EMPTY_DEFINITION}
        onChange={onDefinitionChange}
      />

      <DrillDefinitionEditor
        value={values.jsonText}
        onChange={onJsonTextChange}
        parseError={parseError}
        issues={issues}
        onFormat={onFormat}
      />

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
