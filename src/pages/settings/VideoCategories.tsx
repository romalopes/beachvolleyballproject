import { useEffect, useState } from "react";
import { api, ApiValidationError, type VideoCategory } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

/**
 * Admin management for video categories (`/settings/video-categories`).
 *
 * Editing is inline (name, description, position) — the list is small and
 * this avoids a nested route per row. Deleting a category nullifies the
 * category on its videos rather than deleting them.
 */
export default function VideoCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = form closed, "new" = creating, number = editing that row.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("0");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<VideoCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.roles?.includes("admin")) return;
    let cancelled = false;
    api
      .adminVideoCategories()
      .then((list) => {
        if (cancelled) return;
        setCategories(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load categories.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  // Refresh after a mutation. All state updates happen inside promise
  // callbacks, so this stays safe to call from event handlers.
  const reload = () => {
    api
      .adminVideoCategories()
      .then((list) => {
        setCategories(list);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load categories."),
      );
  };

  const startCreate = () => {
    setEditing("new");
    setName("");
    setDescription("");
    setPosition(String(categories.length));
    setFormError(null);
  };

  const startEdit = (category: VideoCategory) => {
    setEditing(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
    setPosition(String(category.position));
    setFormError(null);
  };

  const closeForm = () => {
    setEditing(null);
    setFormError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const data = {
      name: name.trim(),
      description: description.trim() || null,
      position: position.trim() === "" ? 0 : Number(position),
    };
    try {
      if (editing === "new") {
        await api.adminCreateVideoCategory(data);
      } else if (editing != null) {
        await api.adminUpdateVideoCategory(editing, data);
      }
      closeForm();
      reload();
    } catch (err) {
      setFormError(
        err instanceof ApiValidationError
          ? err.errors.join(", ")
          : err instanceof Error
            ? err.message
            : "Failed to save the category.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyVideoCategory(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete the category.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title="Video Categories"
      description="Manage the sections of the video library. Videos without a category appear under Uncategorized."
      backTo="/settings"
      backLabel="Back to Settings"
      actions={
        <button
          type="button"
          className="admin-btn admin-btn-add settings-add-btn"
          onClick={startCreate}
          disabled={editing === "new"}
        >
          + New Category
        </button>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {editing === "new" && (
        <form className="admin-form" onSubmit={handleSave}>
          {formError && <div className="auth-flash auth-flash-error">{formError}</div>}
          <div className="admin-field">
            <label htmlFor="video-category-name">Name *</label>
            <input
              id="video-category-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Serving"
              maxLength={255}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="video-category-description">Description</label>
            <textarea
              id="video-category-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional: what belongs in this section?"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="video-category-position">Position</label>
            <input
              id="video-category-position"
              type="number"
              min={0}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
              {saving ? "Saving..." : "Create Category"}
            </button>
            <button type="button" className="admin-btn" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {pendingDelete && (
        <DeleteConfirm
          entityName={pendingDelete.name}
          warning="Videos in this category are kept but become Uncategorized. This action cannot be undone."
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : categories.length === 0 ? (
        <EmptyState
          title="No video categories"
          description="Get started by adding a new category."
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Position</th>
                <th>Videos</th>
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                editing === category.id ? (
                  <tr key={category.id}>
                    <td colSpan={5}>
                      <form className="admin-form" onSubmit={handleSave}>
                        {formError && (
                          <div className="auth-flash auth-flash-error">{formError}</div>
                        )}
                        <div className="admin-field">
                          <label htmlFor={`video-category-name-${category.id}`}>Name *</label>
                          <input
                            id={`video-category-name-${category.id}`}
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={255}
                          />
                        </div>
                        <div className="admin-field">
                          <label htmlFor={`video-category-description-${category.id}`}>
                            Description
                          </label>
                          <textarea
                            id={`video-category-description-${category.id}`}
                            rows={2}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </div>
                        <div className="admin-field">
                          <label htmlFor={`video-category-position-${category.id}`}>
                            Position
                          </label>
                          <input
                            id={`video-category-position-${category.id}`}
                            type="number"
                            min={0}
                            value={position}
                            onChange={(event) => setPosition(event.target.value)}
                          />
                        </div>
                        <div className="admin-form-actions">
                          <button
                            type="submit"
                            className="admin-btn admin-btn-add"
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={closeForm}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={category.id}>
                    <td className="admin-table-name">{category.name}</td>
                    <td>{category.description || "—"}</td>
                    <td>{category.position}</td>
                    <td>{category.video_count ?? 0}</td>
                    <td className="admin-table-actions-col">
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-add"
                          onClick={() => startEdit(category)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-remove"
                          onClick={() => {
                            setPendingDelete(category);
                            setDeleteError(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </SettingsLayout>
  );
}

