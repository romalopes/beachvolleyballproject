import { useEffect, useState } from "react";
import {
  api,
  ApiValidationError,
  type VideoSummary,
  type VideoReference,
  type VideoReferenceTarget,
} from "../../api";
import { detectVideoProvider, parseTimestamp } from "../../utils/videos";

interface VideoFormProps {
  target: VideoReferenceTarget;
  targetId: number;
  /** When set the form edits that reference (video URL stays read-only). */
  initial?: VideoReference | null;
  onSaved: (reference: VideoReference) => void;
  onCancel: () => void;
}

type CreateMode = "url" | "library";

/**
 * Add/edit form for a VideoReference. On create the video can be supplied two
 * ways: pasting an external URL (creates or reuses the Video) or picking one
 * from the existing library (`video_id` — no duplicate Video is created).
 * Editing only touches the reference fields; the video stays fixed.
 */
export default function VideoForm({
  target,
  targetId,
  initial,
  onSaved,
  onCancel,
}: VideoFormProps) {
  const editing = Boolean(initial);
  const [mode, setMode] = useState<CreateMode>("url");
  const [library, setLibrary] = useState<VideoSummary[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [videoId, setVideoId] = useState<number | null>(null);
  const [sourceUrl, setSourceUrl] = useState(initial?.video.source_url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [start, setStart] = useState(
    initial?.start_seconds != null ? String(initial.start_seconds) : "",
  );
  const [end, setEnd] = useState(
    initial?.end_seconds != null ? String(initial.end_seconds) : "",
  );
  const [position, setPosition] = useState(
    initial ? String(initial.position) : "",
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const detected = detectVideoProvider(sourceUrl);

  // The library is only fetched when the coach chooses "choose existing".
  useEffect(() => {
    if (editing || mode !== "library") return;
    let cancelled = false;
    api
      .videos()
      .then((videos) => {
        if (cancelled) return;
        setLibrary(videos);
        setVideoId((current) => current ?? videos[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setErrors(["Failed to load the video library."]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, mode]);

  const filteredLibrary = library.filter((video) =>
    (video.title || `Video ${video.id}`)
      .toLowerCase()
      .includes(libraryFilter.trim().toLowerCase()),
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation: string[] = [];
    if (!editing && mode === "url" && !detected) {
      validation.push("Enter a valid video URL (YouTube, Vimeo, Instagram, TikTok or any http(s) link).");
    }
    if (!editing && mode === "library" && videoId == null) {
      validation.push("Choose a video from the library.");
    }
    const startSeconds = start.trim() ? parseTimestamp(start) : null;
    const endSeconds = end.trim() ? parseTimestamp(end) : null;
    if (start.trim() && startSeconds == null) validation.push("Start must use MM:SS or HH:MM:SS.");
    if (end.trim() && endSeconds == null) validation.push("End must use MM:SS or HH:MM:SS.");
    if (startSeconds != null && endSeconds != null && endSeconds <= startSeconds) {
      validation.push("End must be after the start.");
    }
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const data = {
        start_seconds: startSeconds,
        end_seconds: endSeconds,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        ...(editing
          ? {
              position: position.trim() ? Number(position) : undefined,
            }
          : mode === "library"
            ? { video_id: videoId ?? undefined }
            : {
                video: {
                  source_url: sourceUrl.trim(),
                  title: title.trim() || undefined,
                  description: description.trim() || undefined,
                },
              }),
      };
      const reference = editing
        ? await api.updateVideoReference(target, targetId, initial!.id, data)
        : await api.createVideoReference(target, targetId, data);
      onSaved(reference);
    } catch (err) {
      setErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : "Failed to save the video."],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="video-form" onSubmit={handleSubmit}>
      {!editing && (
        <div className="video-form-mode" role="radiogroup" aria-label="Video source">
          <button
            type="button"
            className={mode === "url" ? "active" : ""}
            onClick={() => setMode("url")}
          >
            Paste URL
          </button>
          <button
            type="button"
            className={mode === "library" ? "active" : ""}
            onClick={() => setMode("library")}
          >
            Choose from library
          </button>
        </div>
      )}
      {!editing && mode === "library" && (
        <>
          <label>
            Search library
            <input
              type="text"
              value={libraryFilter}
              placeholder="Filter by title..."
              onChange={(event) => setLibraryFilter(event.target.value)}
            />
          </label>
          <label>
            Library video
            <select
              value={videoId ?? ""}
              onChange={(event) => setVideoId(Number(event.target.value))}
            >
              {filteredLibrary.map((video) => (
                <option key={video.id} value={video.id}>
                  {(video.title || `Video ${video.id}`) + ` (${video.provider_label})`}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {!editing && mode === "url" && (
        <>
          <label>
            Video URL
            <input
              type="text"
              value={sourceUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>
          {detected && (
            <p className="video-form-provider">
              Detected provider: <strong>{detected.label}</strong>
              {detected.embeddable
                ? " — can be played inline"
                : " — will show a Watch link instead of a player"}
            </p>
          )}
        </>
      )}
      {editing && (
        <label>
          Video URL
          <input type="text" value={sourceUrl} readOnly disabled />
        </label>
      )}
      <label>
        Title
        <input
          type="text"
          value={title}
          placeholder="e.g. Serve receive progression"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="video-form-timestamps">
        <label>
          Start
          <input
            type="text"
            value={start}
            placeholder="MM:SS"
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          End
          <input
            type="text"
            value={end}
            placeholder="MM:SS"
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        {editing && (
          <label>
            Position
            <input
              type="number"
              min={0}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </label>
        )}
      </div>
      <label>
        Description
        <textarea
          rows={2}
          value={description}
          placeholder="What should the athlete focus on?"
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {errors.length > 0 && (
        <div className="admin-error">
          <ul>
            {errors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
