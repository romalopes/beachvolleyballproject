import { useEffect, useState } from "react";
import { api, type Category, type Skill } from "../../../../api";

interface SkillFormProps {
  initial?: Skill | null;
  onSuccess: (skill: Skill) => void;
  onCancel: () => void;
}

export default function SkillForm({ initial, onSuccess, onCancel }: SkillFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setCategoryId(String(initial.category_id));
      setDescription(initial.description ?? "");
    }
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (categoryId === "") { setError("Category is required."); return; }
    const payload = {
      title: title.trim(),
      category_id: Number(categoryId),
      description: description.trim() || null,
    };
    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateSkill(initial.id, payload)
        : await api.adminCreateSkill(payload);
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <div className="admin-field">
        <label htmlFor="skill-title">Title *</label>
        <input id="skill-title" type="text" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Forearm Pass" maxLength={255} />
      </div>
      <div className="admin-field">
        <label htmlFor="skill-category">Category *</label>
        <select id="skill-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor="skill-description">Description</label>
        <textarea id="skill-description" value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this skill..." rows={4} />
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update Skill" : "Create Skill"}
        </button>
      </div>
    </form>
  );
}
