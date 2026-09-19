import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  api,
  type VideoReference,
  type VideoReferenceTarget,
} from "../../api";
import { formatReferenceWindow } from "../../utils/videos";
import EmptyState from "../EmptyState";
import VideoForm from "./VideoForm";
import VideoPlayer from "./VideoPlayer";

interface VideoListProps {
  references?: VideoReference[] | null;
  target: VideoReferenceTarget;
  targetId: number | null;
  canManage: boolean;
  /** Called after a reference is added/edited/removed so the page refetches. */
  onChanged?: () => void;
}

/**
 * The reusable videos section shared by the Drill and Skill pages.
 *
 * Performance contract (README "Videos & VideoReferences"): only the selected
 * reference renders a player; the rest are lightweight list entries, so a page
 * never loads dozens of iframes at once.
 */
export default function VideoList({
  references,
  target,
  targetId,
  canManage,
  onChanged,
}: VideoListProps) {
  const ordered = useMemo(
    () => [...(references ?? [])].sort((a, b) => a.position - b.position),
    [references],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<VideoReference | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (ordered.length === 0 && !adding) {
    return (
      <EmptyState
        title="No videos yet"
        description={
          canManage
            ? "Add a video with the button above."
            : "Videos will appear here when added by a coach."
        }
      />
    );
  }

  const active = ordered[Math.min(activeIndex, ordered.length - 1)] ?? null;

  const handleDelete = async (reference: VideoReference) => {
    if (targetId == null) return;
    setError(null);
    try {
      await api.removeVideoReference(target, targetId, reference.id);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the video.");
    }
  };

  return (
    <div className="video-list">
      {canManage && !adding && !editing && (
        <div className="admin-table-actions">
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} /> Add video
          </button>
        </div>
      )}

      {adding && targetId != null && (
        <VideoForm
          target={target}
          targetId={targetId}
          onSaved={() => {
            setAdding(false);
            onChanged?.();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {editing && targetId != null && (
        <VideoForm
          target={target}
          targetId={targetId}
          initial={editing}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {active && !adding && !editing && <VideoPlayer reference={active} />}

      {ordered.length > 1 && (
        <ul className="video-list-selector">
          {ordered.map((reference, index) => (
            <li key={reference.id}>
              <button
                type="button"
                className={index === activeIndex && !adding && !editing ? "active" : ""}
                onClick={() => setActiveIndex(index)}
              >
                {reference.video.thumbnail_url ? (
                  <img src={reference.video.thumbnail_url} alt="" />
                ) : (
                  <span className="video-thumb-placeholder">▶</span>
                )}
                <span className="video-list-item-title">
                  {reference.title || reference.video.title || "Video"}
                </span>
                <span className="video-window">
                  {formatReferenceWindow(reference.start_seconds, reference.end_seconds) ?? ""}
                </span>
              </button>
              {canManage && (
                <span className="video-list-item-actions">
                  <button
                    type="button"
                    aria-label={`Edit ${reference.title || "video"}`}
                    onClick={() => setEditing(reference)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${reference.title || "video"}`}
                    onClick={() => handleDelete(reference)}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <div className="admin-error">{error}</div>}
    </div>
  );
}
