import { useEffect, useState } from "react";
import { api, type AssessmentCategory, type AssessmentDefinition, type AssessmentDefinitionInput, type Category } from "../api";

type DraftRow = AssessmentCategory & { weight: number };
const emptyRow = (position: number): DraftRow => ({ id: 0, category_id: null, category_custom_id: null, source_type: "category", label: "Select a category", weight: 0, position, category: null, category_custom: null });

export default function AssessmentDefinitions() {
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addType, setAddType] = useState<"category" | "custom_category">("category"); const [addId, setAddId] = useState("");
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  function select(definition: AssessmentDefinition | null) {
    if (definition) { setSelectedId(definition.id); setName(definition.name); setDescription(definition.description ?? ""); setRows(definition.assessment_categories.map((row) => ({ ...row, weight: Number(row.weight) }))); }
    else { setSelectedId("new"); setName(""); setDescription(""); setRows([]); }
    setError(null);
  }
  useEffect(() => { Promise.all([api.assessmentDefinitions(), api.categories(), api.categoryCustoms()]).then(([page, standard]) => { setDefinitions(page.data); setCategories(standard); if (page.data[0]) select(page.data[0]); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load assessment definitions.")); }, []);

  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0);
  const remaining = 100 - total;
  const canPublish = total === 100 && rows.length > 0;

  async function addRow() {
    if (addType === "custom_category") {
      const customName = addId.trim();
      if (!customName) { setError("Enter a custom category name."); return; }
      if (rows.some((row) => row.label.toLowerCase() === customName.toLowerCase())) { setError("Choose a category that is not already in this assessment."); return; }
      setSaving(true); setError(null);
      try {
        const custom = await api.createCategoryCustom({ name: customName, visibility: "shared" });
        const next: DraftRow = { ...emptyRow(rows.length), category_custom_id: custom.id, source_type: "custom_category", label: custom.name, category: null, category_custom: custom };
        setRows((current) => [...current, next]);
        setAddId("");
      } catch (err) { setError(err instanceof Error ? err.message : "Failed to create custom category."); } finally { setSaving(false); }
      return;
    }
    const id = Number(addId); const duplicate = rows.some((row) => row.category_id === id);
    if (!addId || duplicate) { setError("Choose a category that is not already in this assessment."); return; }
    const source = categories.find((item) => item.id === id); if (!source) { setError("That category is no longer available."); return; }
    const next: DraftRow = { ...emptyRow(rows.length), category_id: id, source_type: "category", label: source.name, category: source, category_custom: null };
    setRows([...rows, next]); setAddId(""); setError(null);
  }
  function move(index: number, direction: -1 | 1) { const next = [...rows]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setRows(next.map((row, position) => ({ ...row, position }))); }
  async function save(nextStatus: "draft" | "active") {
    if (!name.trim()) { setError("Give the assessment a name."); return; } if (nextStatus === "active" && !canPublish) { setError("Weights must total 100% before publishing."); return; }
    const input: AssessmentDefinitionInput = { name: name.trim(), description: description.trim() || null, status: nextStatus, assessment_categories_attributes: rows.map((row) => ({ id: row.id || undefined, category_id: row.category_id, category_custom_id: row.category_custom_id, weight: row.weight, position: row.position })) };
    setSaving(true); setError(null); try { const saved = selectedId && selectedId !== "new" ? await api.updateAssessmentDefinition(selectedId, input) : await api.createAssessmentDefinition(input); setDefinitions((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); select(saved); } catch (err) { setError(err instanceof Error ? err.message : "Failed to save assessment definition."); } finally { setSaving(false); }
  }

  return (
    <div className="page assessment-definitions-page">
      <header className="assessment-definitions-header">
        <div>
          <span className="section-label">Assessment configuration</span>
          <h1>Assessment definitions</h1>
          <p>Build reusable weighted assessments.</p>
        </div>
        <label className="assessment-definition-select">
          Definition
          <select
            aria-label="Assessment definition"
            value={selectedId ?? "new"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "new") select(null);
              else {
                const definition = definitions.find((item) => String(item.id) === value);
                if (definition) select(definition);
              }
            }}
          >
            <option value="new">New definition</option>
            {definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name} ({definition.status})
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <div className="admin-error" role="alert">{error}</div>}

      <section className="assessment-definition-panel" aria-label="Definition details">
        <div className="assessment-definition-fields">
          <label className="admin-field">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="admin-field">
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>

        <div className="assessment-definition-section-heading">
          <div>
            <h2>Categories</h2>
            <p className="assessment-definition-help">
              Assign a positive weight to every category. Drafts may be incomplete.
            </p>
          </div>
          <span className={`assessment-definition-total ${total === 100 ? "balanced" : ""}`}>
            Total: {total}%
            {remaining > 0 ? ` · ${remaining}% remaining` : remaining < 0 ? ` · ${Math.abs(remaining)}% over allocated` : " · balanced"}
          </span>
        </div>

        <div className="assessment-definition-rows" aria-label="Selected categories">
          {rows.length === 0 ? <p className="assessment-definition-empty">No categories selected yet.</p> : rows.map((row, index) => (
            <div className="assessment-definition-row" key={row.id || `${row.source_type}-${index}`}>
              <div className="assessment-definition-label">
                <strong>{index + 1}. {row.label}</strong>
                <span>{row.source_type === "category" ? "Standard category" : "Custom category"}</span>
              </div>
              <label className="assessment-definition-weight">
                Weight
                <input
                  type="number"
                  min="1"
                  step="1"
                  aria-label={`Weight for ${row.label}`}
                  value={row.weight}
                  onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, weight: Number(event.target.value) } : item))}
                />
                <span>%</span>
              </label>
              <div className="assessment-definition-row-actions">
                <button type="button" className="admin-btn" onClick={() => move(index, -1)} disabled={index === 0}>Up</button>
                <button type="button" className="admin-btn" onClick={() => move(index, 1)} disabled={index === rows.length - 1}>Down</button>
                <button type="button" className="admin-btn admin-btn-remove" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="assessment-definition-add">
          <label className="admin-field">
            Category type
            <select aria-label="Category type" value={addType} onChange={(event) => { setAddType(event.target.value as "category" | "custom_category"); setAddId(""); setError(null); }}>
              <option value="category">Standard category</option>
              <option value="custom_category">Custom category</option>
            </select>
          </label>
          {addType === "category" ? (
            <label className="admin-field">
              Category
              <select aria-label="Add category" value={addId} onChange={(event) => setAddId(event.target.value)}>
                <option value="">Select a category</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="admin-field">
              New custom category
              <input aria-label="New custom category" value={addId} onChange={(event) => setAddId(event.target.value)} placeholder="Enter a custom category name" />
            </label>
          )}
          <button type="button" className="admin-btn admin-btn-add" onClick={addRow}>Add category</button>
        </div>
      </section>

      <div className="admin-form-actions assessment-definition-actions">
        <button type="button" className="admin-btn" disabled={saving} onClick={() => save("draft")}>Save draft</button>
        <button type="button" className="admin-btn admin-btn-add" disabled={saving || !canPublish} onClick={() => save("active")}>Publish</button>
      </div>
    </div>
  );

}
