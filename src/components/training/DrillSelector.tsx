import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Category, Drill, Skill, TrainingSessionDrillInput } from '../../api';
import { moveFocus } from './focusDraft';

export interface DrillDraft extends TrainingSessionDrillInput {
  key: string;
  drill: Drill;
}

interface DrillSelectorProps {
  categories: Category[];
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

export default function DrillSelector({
  categories,
  skills,
  drills,
  focusSkillIds,
  focusSkillNames,
  selected,
  onChange,
}: DrillSelectorProps) {
  const [categoryId, setCategoryId] = useState<string>('');
  const [skillId, setSkillId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(true);

  const focusSet = useMemo(() => new Set(focusSkillIds), [focusSkillIds]);

  const recommended = useMemo(
    () =>
      focusSet.size === 0
        ? []
        : drills.filter((drill) => drillSkillIds(drill).some((id) => focusSet.has(id))),
    [drills, focusSet]
  );

  const categorySkills = useMemo(
    () => skills.filter((s) => (categoryId ? s.category_id === Number(categoryId) : true)),
    [skills, categoryId]
  );

  const selectedIds = useMemo(() => new Set(selected.map((row) => row.drill_id)), [selected]);

  const candidates = useMemo(() => {
    const pool = showRecommendedOnly && focusSet.size > 0 ? recommended : drills;
    const term = search.trim().toLowerCase();
    return pool.filter((drill) => {
      if (selectedIds.has(drill.id)) return false;
      if (
        categoryId &&
        !drillSkillIds(drill).some((id) => {
          const skill = skills.find((s) => s.id === id);
          return skill?.category_id === Number(categoryId);
        })
      ) {
        return false;
      }
      if (skillId && !drillSkillIds(drill).includes(Number(skillId))) return false;
      if (term && !drill.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [showRecommendedOnly, focusSet, recommended, drills, selectedIds, categoryId, skillId, search, skills]);

  const handleAdd = (drill: Drill) => {
    onChange([
      ...selected,
      { key: nextDrillKey(), drill_id: drill.id, drill, duration_minutes: null, notes: '' },
    ]);
  };

  const updateRow = (key: string, patch: Partial<DrillDraft>) => {
    onChange(selected.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <div className="training-editor-section" role="group" aria-label="Drills">
      <h3>Drills</h3>
      {selected.length === 0 ? (
        <p className="related-item-meta">No drills selected yet.</p>
      ) : (
        <ol className="training-drill-editor-list">
          {selected.map((row, index) => (
            <li key={row.key} className="training-drill-editor-row">
              <span className="training-focus-title">
                {index + 1}. {row.drill.title}
              </span>
              <label>
                Duration (minutes)
                <input
                  type="number"
                  min={1}
                  value={row.duration_minutes ?? ''}
                  onChange={(event) =>
                    updateRow(row.key, {
                      duration_minutes: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  placeholder="e.g. 15"
                />
              </label>
              <label>
                Session notes
                <textarea
                  value={row.notes ?? ''}
                  onChange={(event) => updateRow(row.key, { notes: event.target.value })}
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
                  onClick={() => onChange(moveFocus(selected, index, -1))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move drill ${index + 1} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => onChange(moveFocus(selected, index, 1))}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  aria-label={`Remove drill ${index + 1}`}
                  onClick={() => onChange(selected.filter((item) => item.key !== row.key))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="training-focus-form">
        <h4>Add Drill</h4>
        {focusSet.size === 0 ? (
          <p className="related-item-meta">
            Select one or more skill-based focuses to see recommended drills. You can also browse
            drills manually below.
          </p>
        ) : (
          <p className="related-item-meta">
            Recommended drills based on: {focusSkillNames.join(', ')}
          </p>
        )}

        <div className="training-focus-type">
          <label>
            <input
              type="checkbox"
              checked={showRecommendedOnly}
              disabled={focusSet.size === 0}
              onChange={(event) => setShowRecommendedOnly(event.target.checked)}
            />
            Recommended only
          </label>
        </div>

        <label>
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Skill
          <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
            <option value="">All skills</option>
            {categorySkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search drills
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by drill title"
          />
        </label>

        {candidates.length === 0 ? (
          <p className="related-item-meta">No matching drills.</p>
        ) : (
          <ul className="training-drill-candidates">
            {candidates.map((drill) => (
              <li key={drill.id}>
                <span>{drill.title}</span>
                <button type="button" className="admin-btn admin-btn-add" onClick={() => handleAdd(drill)}>
                  <Plus size={14} />
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
