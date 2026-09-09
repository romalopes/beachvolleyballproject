import { useEffect, useState } from "react";
import { api, type Category } from "../../../../api";

interface CategoryFormProps {
  initial?: Category | null;
  onSuccess: (category: Category) => void;
  onCancel: () => void;
}

export default function CategoryForm({ initial, onSuccess, onCancel }: CategoryFormProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) setName(initial.name);
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    try {
      const saved = initial
        ? await api.adminUpdateCategory(initial.id, { name: name.trim() })
        : await api.adminCreateCategory({ name: name.trim() });
      onSuccess(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <div className="admin-field">
        <label htmlFor="category-name">Name *</label>
        <input id="category-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Serving" maxLength={255} />
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update Category" : "Create Category"}
        </button>
      </div>
    </form>
  );
}
