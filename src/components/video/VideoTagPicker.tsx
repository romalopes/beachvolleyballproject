import { useEffect, useMemo, useState } from "react";
import { api, ApiValidationError, type VideoTag } from "../../api";
import { formatVideoTagName } from "../../utils/videos";

interface VideoTagPickerProps {
  /** Selected tag ids; submitted as `video_tag_ids` by the caller. */
  value: number[];
  onChange: (tagIds: number[]) => void;
  /** Shows a filter box above the available tags. */
  searchable?: boolean;
  /** Admins may create a tag inline; coaches only pick existing ones. */
  allowCreate?: boolean;
  disabled?: boolean;
  label?: string;
}

/**
 * Multi-select tag widget shared by the video forms.
 *
 * The full tag list is loaded once and filtered client-side: the tag count is
 * small and this keeps selection instantaneous (no request per keystroke).
 * Creating a tag is an admin-only endpoint, so the affordance stays hidden
 * unless the caller explicitly allows it.
 */
export default function VideoTagPicker({
  value,
  onChange,
  searchable = false,
  allowCreate = false,
  disabled = false,
  label = "Filter tags",
}: VideoTagPickerProps) {
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .videoTags()
      .then((list) => {
        if (!cancelled) setTags(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError("Failed to load tags.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => value.map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is VideoTag => Boolean(tag)),
    [tags, value],
  );

  const needle = query.trim().toLowerCase();
  const available = useMemo(() => tags.filter((tag) => !value.includes(tag.id)), [tags, value]);
  const suggestions = useMemo(
    () => available.filter((tag) => tag.name.toLowerCase().includes(needle)),
    [available, needle],
  );

  const canCreate =
    allowCreate && needle.length > 0 && !tags.some((tag) => tag.name.toLowerCase() === needle);

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((tagId) => tagId !== id) : [...value, id]);
  };

  const handleCreate = async () => {
    if (!needle) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.adminCreateVideoTag({ name: needle });
      setTags((current) =>
        current.some((tag) => tag.id === created.id) ? current : [...current, created],
      );
      onChange([...value, created.id]);
      setQuery("");
    } catch (err) {
      setError(
        err instanceof ApiValidationError
          ? err.errors.join(", ")
          : err instanceof Error
            ? err.message
            : "Failed to create the tag.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="video-tag-picker">
      {selected.length > 0 && (
        <ul className="video-tag-chips" aria-label="Selected tags">
          {selected.map((tag) => (
            <li key={tag.id}>
              <span>{formatVideoTagName(tag.name)}</span>
              <button
                type="button"
                aria-label={`Remove tag ${tag.name}`}
                onClick={() => toggle(tag.id)}
                disabled={disabled}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchable && (
        <input
          type="text"
          aria-label={label}
          placeholder="Type to filter tags..."
          value={query}
          disabled={disabled || loading}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      {loading ? (
        <p className="video-tag-picker-note">Loading tags…</p>
      ) : (
        <>
          {(searchable ? suggestions : available).length > 0 ? (
            <ul className="video-tag-options">
              {(searchable ? suggestions : available).map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => toggle(tag.id)}
                    disabled={disabled}
                    aria-label={`Add tag ${tag.name}`}
                  >
                    + {formatVideoTagName(tag.name)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !canCreate && <p className="video-tag-picker-note">No tags found.</p>
          )}
          {canCreate && (
            <button
              type="button"
              className="admin-btn admin-btn-add video-tag-picker-create"
              onClick={handleCreate}
              disabled={disabled || creating}
            >
              {creating ? "Creating…" : `Create tag “${needle}”`}
            </button>
          )}
        </>
      )}

      {error && <div className="admin-error">{error}</div>}
    </div>
  );
}
