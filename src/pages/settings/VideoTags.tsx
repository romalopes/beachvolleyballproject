import { useEffect, useState } from "react";
import { api, ApiValidationError, type VideoTag } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import EmptyState from "../../components/EmptyState";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import { formatVideoTagName } from "../../utils/videos";
import { GripVertical } from "lucide-react";

/**
 * Admin management for video tags (`/settings/video-tags`).
 *
 * Tags are normalized by the backend (trim + downcase), so created names are
 * shown with the same formatting used across the app. Order is managed by
 * drag-and-drop (the model appends new tags and the reorder endpoint rewrites
 * every position to its index). Deleting a tag removes it from videos but never
 * touches the videos themselves.
 */
export default function VideoTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Drag-and-drop ordering (see the reorder endpoint): positions are
  // app-managed, so there is no number field to edit.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<VideoTag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.roles?.includes("admin")) return;
    let cancelled = false;
    api
      .adminVideoTags()
      .then((list) => {
        if (cancelled) return;
        setTags(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tags.");
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
      .adminVideoTags()
      .then((list) => {
        setTags(list);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load tags."),
      );
  };

  const startCreate = () => {
    setEditing("new");
    setName("");
    setFormError(null);
  };

  const startEdit = (tag: VideoTag) => {
    setEditing(tag.id);
    setName(tag.name);
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
    try {
      if (editing === "new") {
        await api.adminCreateVideoTag({ name: name.trim() });
      } else if (editing != null) {
        await api.adminUpdateVideoTag(editing, { name: name.trim() });
      }
      closeForm();
      reload();
    } catch (err) {
      setFormError(
        err instanceof ApiValidationError
          ? err.errors.join(", ")
          : err instanceof Error
            ? err.message
            : "Failed to save the tag.",
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
      await api.adminDestroyVideoTag(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete the tag.");
    } finally {
      setDeleting(false);
    }
  };

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? tags.filter((tag) => tag.name.toLowerCase().includes(needle))
    : tags;

  // Dragging is off while a form is open, a reorder is in flight, or the list is
  // filtered: a partial view cannot express the full list's order.
  const dragDisabled = reordering || editing !== null || needle !== "";

  const handleDragStart = (tag: VideoTag) => {
    setDragId(tag.id);
    setDropId(null);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLTableRowElement>,
    tag: VideoTag,
  ) => {
    if (dragId === null || dragId === tag.id) return;
    // preventDefault is what makes the row a valid drop target.
    event.preventDefault();
    setDropId(tag.id);
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLTableRowElement>,
    target: VideoTag,
  ) => {
    event.preventDefault();
    const sourceId = dragId;
    setDragId(null);
    setDropId(null);
    if (sourceId === null || sourceId === target.id) return;

    const fromIndex = tags.findIndex((t) => t.id === sourceId);
    const toIndex = tags.findIndex((t) => t.id === target.id);
    const moved = tags[fromIndex];
    if (fromIndex === -1 || toIndex === -1 || !moved) return;

    const previous = tags;
    const next = [...tags];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setTags(next); // optimistic: the row lands immediately
    setReordering(true);
    try {
      // The API renumbers the whole list, so send every id in the new order.
      const saved = await api.adminReorderVideoTags(next.map((t) => t.id));
      setTags(saved);
      setError(null);
    } catch (err) {
      setTags(previous);
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
      title="Video Tags"
      description="Manage the tags coaches can attach to videos."
      backTo="/settings"
      backLabel="Back to Settings"
      actions={
        <button
          type="button"
          className="admin-btn admin-btn-add settings-add-btn"
          onClick={startCreate}
          disabled={editing === "new"}
        >
          + New Tag
        </button>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {editing === "new" && (
        <form className="admin-form" onSubmit={handleSave}>
          {formError && <div className="auth-flash auth-flash-error">{formError}</div>}
          <div className="admin-field">
            <label htmlFor="video-tag-name">Name *</label>
            <input
              id="video-tag-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. reception"
              maxLength={255}
            />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
              {saving ? "Saving..." : "Create Tag"}
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
          warning="This removes the tag from every video that uses it. The videos themselves are kept."
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}

      <input
        type="search"
        aria-label="Filter tags"
        placeholder="Filter by name..."
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />

      {loading ? (
        <div className="loading">Loading...</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={needle ? "No tags match the filter" : "No tags yet"}
          description={needle ? undefined : "Get started by adding a new tag."}
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-table-drag-col" aria-label="Reorder" />
                <th>Name</th>
                <th>Videos</th>
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tag) =>
                editing === tag.id ? (
                  <tr key={tag.id}>
                    <td colSpan={4}>
                      <form className="admin-form" onSubmit={handleSave}>
                        {formError && (
                          <div className="auth-flash auth-flash-error">{formError}</div>
                        )}
                        <div className="admin-field">
                          <label htmlFor={`video-tag-name-${tag.id}`}>Name *</label>
                          <input
                            id={`video-tag-name-${tag.id}`}
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={255}
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
                    key={tag.id}
                    className={
                      dragId === tag.id
                        ? "admin-table-row-dragging"
                        : dropId === tag.id
                          ? "admin-table-row-drop-target"
                          : undefined
                    }
                    draggable={!dragDisabled}
                    onDragStart={() => handleDragStart(tag)}
                    onDragOver={(event) => handleDragOver(event, tag)}
                    onDrop={(event) => handleDrop(event, tag)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="admin-table-drag-col">
                      <span className="admin-drag-handle" title="Drag to reorder">
                        <GripVertical size={16} aria-hidden="true" />
                      </span>
                    </td>
                    <td className="admin-table-name">{formatVideoTagName(tag.name)}</td>
                    <td>{tag.video_count ?? 0}</td>
                    <td className="admin-table-actions-col">
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-add"
                          onClick={() => startEdit(tag)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-remove"
                          onClick={() => {
                            setPendingDelete(tag);
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
