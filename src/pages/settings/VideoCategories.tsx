import { useEffect, useState } from "react";
import { api, ApiValidationError, type VideoCategory } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import { GripVertical } from "lucide-react";

/**
 * Admin management for video categories (`/settings/video-categories`).
 *
 * Editing is inline (name, description) — the list is small and this avoids a
 * nested route per row. Order is managed by drag-and-drop rather than a typed
 * position: manual entry allowed duplicates, while a drop rewrites every
 * position to its index. Deleting a category nullifies the category on its
 * videos rather than deleting them.
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drag-and-drop ordering. `dragId` fades the row being moved, `dropId`
  // highlights where it would land, and `reordering` blocks further drags
  // while the new order is being persisted.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

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
    setFormError(null);
  };

  const startEdit = (category: VideoCategory) => {
    setEditing(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
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

  // Dragging is off while a form is open or a reorder is already in flight.
  const dragDisabled = reordering || editing !== null;

  const handleDragStart = (category: VideoCategory) => {
    setDragId(category.id);
    setDropId(null);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLTableRowElement>,
    category: VideoCategory,
  ) => {
    if (dragId === null || dragId === category.id) return;
    // preventDefault is what makes the row a valid drop target.
    event.preventDefault();
    setDropId(category.id);
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLTableRowElement>,
    target: VideoCategory,
  ) => {
    event.preventDefault();
    const sourceId = dragId;
    setDragId(null);
    setDropId(null);
    if (sourceId === null || sourceId === target.id) return;

    const fromIndex = categories.findIndex((c) => c.id === sourceId);
    const toIndex = categories.findIndex((c) => c.id === target.id);
    const moved = categories[fromIndex];
    if (fromIndex === -1 || toIndex === -1 || !moved) return;

    const previous = categories;
    const next = [...categories];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setCategories(next); // optimistic: the row lands immediately
    setReordering(true);
    try {
      // The API renumbers the whole list, so send every id in the new order.
      const saved = await api.adminReorderVideoCategories(next.map((c) => c.id));
      setCategories(saved);
      setError(null);
    } catch (err) {
      setCategories(previous);
      setError(err instanceof Error ? err.message : "Failed to save the new order.");
    } finally {
      setReordering(false);
    }
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDropId(null);
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
                <th className="admin-table-drag-col" aria-label="Reorder" />
                <th>Name</th>
                <th>Description</th>
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
                  <tr
                    key={category.id}
                    className={
                      dragId === category.id
                        ? "admin-table-row-dragging"
                        : dropId === category.id
                          ? "admin-table-row-drop-target"
                          : undefined
                    }
                    draggable={!dragDisabled}
                    onDragStart={() => handleDragStart(category)}
                    onDragOver={(event) => handleDragOver(event, category)}
                    onDrop={(event) => handleDrop(event, category)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="admin-table-drag-col">
                      <span className="admin-drag-handle" title="Drag to reorder">
                        <GripVertical size={16} aria-hidden="true" />
                      </span>
                    </td>
                    <td className="admin-table-name">{category.name}</td>
                    <td>{category.description || "—"}</td>
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

