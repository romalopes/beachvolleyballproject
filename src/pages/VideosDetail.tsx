import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Play, Trash2 } from "lucide-react";
import { api, ApiValidationError, type VideoSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import VideoProviderBadge from "../components/video/VideoProviderBadge";
import VideoForm from "../components/video/VideoForm";

/**
 * Video detail page (`/videos/:id`).
 *
 * Playback is decided by the backend (`can_embed` + `embed_url`): an
 * embeddable provider renders a lazy allowlisted iframe, anything else renders
 * a thumbnail plus an external "Watch on …" link — never a broken iframe.
 */
export default function VideosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState<VideoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .video(id)
      .then((data) => {
        setVideo(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load the video."),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const isAdmin = Boolean(user?.roles?.includes("admin"));
  const canManage = Boolean(video && (isAdmin || (user && video.created_by_id === user.id)));

  // A video is shared across every reference, so usage is surfaced as a count
  // of the drills/skills/training sessions it is attached to.
  const usageLabel = useMemo(() => {
    const count = video?.reference_count ?? 0;
    if (count === 0) return "Not used in any drill or skill yet.";
    return `Used in ${count} ${count === 1 ? "drill or skill" : "drills or skills"}.`;
  }, [video?.reference_count]);

  const handleDelete = async () => {
    if (!video) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteVideo(video.id);
      navigate("/videos");
    } catch (err) {
      setDeleteError(
        err instanceof ApiValidationError
          ? err.errors.join(", ")
          : err instanceof Error
            ? err.message
            : "Failed to delete the video.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p>Loading video…</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="page">
        <Link to="/videos" className="settings-back-link">
          <ArrowLeft size={14} /> Back to videos
        </Link>
        <div className="admin-error">{error ?? "Video not found."}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/videos" className="settings-back-link">
        <ArrowLeft size={14} /> Back to videos
      </Link>
      <PageHeader title={video.title ?? "Untitled video"} description={video.description ?? undefined}>
        <div className="video-detail-actions">
          {canManage && !editing && (
            <>
              <button type="button" className="admin-btn" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-remove"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {deleteError && <div className="admin-error">{deleteError}</div>}

      {editing ? (
        <VideoForm
          video={video}
          onSaved={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="video-detail-player">
            {video.can_embed && video.embed_url ? (
              playing ? (
                <iframe
                  className="video-embed"
                  src={video.embed_url}
                  title={video.title ?? "Video"}
                  loading="lazy"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className="video-detail-poster"
                  aria-label={`Play ${video.title ?? "video"}`}
                  onClick={() => setPlaying(true)}
                >
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" />
                  ) : (
                    <span className="video-placeholder">▶</span>
                  )}
                  <span className="video-detail-play">
                    <Play size={20} />
                  </span>
                </button>
              )
            ) : (
              <a
                className="video-fallback"
                href={video.external_url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title ?? "Video"} />
                ) : (
                  <span className="video-placeholder">▶</span>
                )}
              </a>
            )}
          </div>

          <dl className="video-detail-meta">
            <div>
              <dt>Provider</dt>
              <dd>
                <VideoProviderBadge label={video.provider_label} />
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{video.video_category?.name ?? "Uncategorized"}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd className="video-detail-tags">
                {video.video_tags && video.video_tags.length > 0 ? (
                  video.video_tags.map((tag) => (
                    <span key={tag.id} className="video-card-tag">
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <span>No tags</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>{usageLabel}</dd>
            </div>
          </dl>

          <div className="videos-links">
            <a href={video.external_url} target="_blank" rel="noreferrer noopener">
              Open on {video.provider_label}
            </a>
          </div>
        </>
      )}

      {!canManage && !editing && (
        <EmptyState
          title="Read-only"
          description="Only the coach who added this video (or an admin) can edit or delete it."
        />
      )}
    </div>
  );
}
