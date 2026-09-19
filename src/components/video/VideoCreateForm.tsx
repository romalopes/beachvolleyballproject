import { useState } from "react";
import {
  api,
  ApiValidationError,
} from "../../api";
import { detectVideoProvider } from "../../utils/videos";

interface VideoCreateFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Standalone video creation for the /videos library page: a Video can exist
 * without being attached to anything and is attached later from the
 * drill/skill/training video forms ("Choose from library").
 */
export default function VideoCreateForm({ onSaved, onCancel }: VideoCreateFormProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const detected = detectVideoProvider(sourceUrl);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detected) {
      setErrors([
        "Enter a valid video URL (YouTube, Vimeo, Instagram, TikTok or any http(s) link).",
      ]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await api.createVideo({
        source_url: sourceUrl.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      onSaved();
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
      <label>
        Title
        <input
          type="text"
          value={title}
          placeholder="e.g. Beach volleyball masterclass"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          rows={2}
          value={description}
          placeholder="Optional note about this video"
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
