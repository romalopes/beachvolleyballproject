import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from "lucide-react";
import type { Drill, Skill, TrainingSessionDrillInput } from "../../api";
import { DRILL_DURATION_OPTIONS, durationChoices } from "../../utils/training";
import { moveFocus } from "./focusDraft";

export interface DrillDraft extends TrainingSessionDrillInput {
  key: string;
  drill: Drill;
}

interface DrillSelectorProps {
  skills: Skill[];
  drills: Drill[];
  focusSkillIds: number[];
  focusSkillNames: string[];
  selected: DrillDraft[];
  onChange: (drills: DrillDraft[]) => void;
}

let drillKey = 0;
const nextDrillKey = () => `drill-${Date.now()}-${(drillKey += 1)}`;

function drillSkillIds(drill: Drill): number[] {
  return (drill.skills ?? []).map((skill) => skill.id);
}

// Drills are recommended from the Skills the training focuses on. The coach can
// switch to the full catalogue to browse manually, but a drill is only ever
// referenced — never created or edited — from this screen.
export default function DrillSelector({
  skills,
  drills,
  focusSkillIds,
  focusSkillNames,
  selected,
  onChange,
}: DrillSelectorProps) {
  const [recommendedOnly, setRecommendedOnly] = useState(true);
  const [search, setSearch] = useState("");
  // The filter is bound to the exact set of focus skills it was chosen against,
  // so changing the focuses above resets it — no effect needed.
  const [skillFilter, setSkillFilter] = useState<{
    skillId: number;
    focusSkills: string;
  } | null>(null);
  const selectedIds = useMemo(
    () => new Set(selected.map((row) => row.drill_id)),
    [selected],
  );

  // The focus skills drive the recommendation, so name them in the header. The
  // catalogue supplies the name; the focus is the fallback.
  const skillLabel = (skillId: number, index: number) =>
    skills.find((skill) => skill.id === skillId)?.title ??
    focusSkillNames[index] ??
    "Unknown skill";

  const focusSkillLabel = focusSkillIds
    .map((skillId, index) => skillLabel(skillId, index))
    .join(", ");

  const recommended = useMemo(
    () =>
      drills.filter((drill) =>
        drillSkillIds(drill).some((id) => focusSkillIds.includes(id)),
      ),
    [drills, focusSkillIds],
  );

  // The per-skill filter only applies while the focus skills are unchanged.
  const focusSkillsSignature = focusSkillIds.join(",");
  const activeSkillFilter =
    skillFilter?.focusSkills === focusSkillsSignature
      ? skillFilter.skillId
      : null;
  const activeSkillName =
    activeSkillFilter == null
      ? null
      : skillLabel(activeSkillFilter, focusSkillIds.indexOf(activeSkillFilter));

  // Selected drills leave the candidate list, so everything offered can still
  // be added. A chosen skill then narrows whichever set is on screen.
  const candidates = (recommendedOnly ? recommended : drills)
    .filter((drill) => !selectedIds.has(drill.id))
    .filter(
      (drill) =>
        activeSkillFilter == null ||
        drillSkillIds(drill).includes(activeSkillFilter),
    );

  // Typing a name narrows whatever list is on screen: the recommended drills, or
  // the whole catalogue once "Recommended only" is unticked.
  const term = search.trim();
  const visibleCandidates = term
    ? candidates.filter((drill) =>
        drill.title.toLowerCase().includes(term.toLowerCase()),
      )
    : candidates;

  const emptyMessage = (() => {
    // "Defensive Movement drills" vs plain "drills" — the no-filter copy is
    // unchanged.
    const scope = activeSkillName ? `${activeSkillName} ` : "";
    if (term) {
      if (recommendedOnly) {
        return `No recommended ${scope}drills match "${term}". Untick "Recommended only" to search the full catalogue.`;
      }
      return `No ${scope}drills match "${term}".`;
    }
    if (recommendedOnly) {
      return activeSkillName
        ? `No more ${activeSkillName} drills are recommended. Untick "Recommended only" to browse the full catalogue.`
        : 'No more recommended drills for these skills. Untick "Recommended only" to browse the full catalogue.';
    }
    return "Every drill is already part of this training.";
  })();

  const handleAdd = (drill: Drill) => {
    onChange([
      ...selected,
      {
        key: nextDrillKey(),
        drill_id: drill.id,
        drill,
        duration_minutes: null,
        notes: "",
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<DrillDraft>) => {
    onChange(
      selected.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const moveRow = (index: number, delta: -1 | 1) => {
    onChange(moveFocus(selected, index, delta));
  };

  const removeRow = (key: string) => {
    onChange(selected.filter((row) => row.key !== key));
  };

  if (focusSkillIds.length === 0) {
    return (
      <div className="training-editor-section" role="group" aria-label="Drills">
        <h3>Drills</h3>
        <p className="related-item-meta">
          Add a skill-based focus above to see recommended drills for that
          skill.
        </p>
      </div>
    );
  }

  return (
    <div className="training-editor-section" role="group" aria-label="Drills">
      <h3>Drills</h3>

      <div className="training-drill-selector">
        <p className="related-item-meta">
          Recommended drills based on {focusSkillLabel}.
        </p>
        <div className="training-drill-filters">
          <label className="training-drill-recommended-toggle">
            <input
              type="checkbox"
              checked={recommendedOnly}
              onChange={(event) => setRecommendedOnly(event.target.checked)}
            />
            Recommended only
          </label>
          <label className="training-drill-skill-filter">
            Skill
            <select
              value={activeSkillFilter ?? ""}
              aria-label="Filter drills by skill"
              onChange={(event) =>
                setSkillFilter(
                  event.target.value
                    ? {
                        skillId: Number(event.target.value),
                        focusSkills: focusSkillsSignature,
                      }
                    : null,
                )
              }
            >
              <option value="">All skills</option>
              {focusSkillIds.map((skillId, index) => (
                <option key={skillId} value={skillId}>
                  {skillLabel(skillId, index)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="search-bar training-drill-search">
          <span className="search-bar-icon">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search drills..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search drills"
          />
        </div>

        {visibleCandidates.length === 0 ? (
          <p className="related-item-meta">{emptyMessage}</p>
        ) : (
          <ul className="training-drill-candidates">
            {visibleCandidates.map((drill) => (
              <li key={drill.id} className="training-drill-candidate">
                <span className="training-drill-candidate-title">
                  {drill.title}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-add"
                  onClick={() => handleAdd(drill)}
                >
                  <Plus size={14} />
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length === 0 ? (
        <p className="related-item-meta">
          No drills selected yet. Add one from above.
        </p>
      ) : (
        <ul className="training-drill-editor-list">
          {selected.map((row, index) => (
            <li key={row.key} className="training-drill-editor-row">
              <span className="training-focus-title">
                {index + 1}. {row.drill.title}
              </span>
              <label className="training-drill-editor-field">
                Duration (minutes)
                <select
                  value={row.duration_minutes ?? "20"}
                  onChange={(event) =>
                    updateRow(row.key, {
                      duration_minutes: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Not set</option>
                  {durationChoices(
                    DRILL_DURATION_OPTIONS,
                    row.duration_minutes,
                  ).map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes}
                    </option>
                  ))}
                </select>
              </label>
              <label className="training-drill-editor-field">
                Session notes
                <textarea
                  value={row.notes ?? ""}
                  onChange={(event) =>
                    updateRow(row.key, { notes: event.target.value })
                  }
                  placeholder="Training-specific instructions (the drill itself is unchanged)."
                  rows={2}
                />
              </label>
              <div className="training-editor-row-actions">
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move drill ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveRow(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move drill ${index + 1} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => moveRow(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  aria-label={`Remove drill ${index + 1}`}
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
