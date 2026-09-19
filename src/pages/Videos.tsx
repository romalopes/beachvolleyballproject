import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, type VideoCategory, type VideoSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import VideoCard from "../components/video/VideoCard";
import VideoCreateForm from "../components/video/VideoCreateForm";

interface VideoGroup {
  /** null is the "Uncategorized" bucket, always rendered last. */
  category: VideoCategory | null;
  videos: VideoSummary[];
}

/**
 * The video library: every video grouped under its category.
 *
 * Grouping is derived from the videos themselves (so a video whose category is
 * missing from a partially-failed categories request still shows up), then
 * ordered by the category `position`. Empty categories are skipped, and
 * uncategorized videos are collected into a final section.
 */
export default function Videos() {
  const { user } = useAuth();
  const canManage =
    user?.roles?.some((role) => role === "coach" || role === "curator" || role === "admin") ?? false;
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.videos(), api.videoCategories()])
      .then(([videoList, categoryList]) => {
        if (cancelled) return;
        setVideos(videoList);
        setCategories(categoryList);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load the video library.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const groups = useMemo<VideoGroup[]>(() => {
    const ordered = [...categories].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    const positionById = new Map(ordered.map((category, index) => [category.id, index]));

    const buckets = new Map<number, VideoGroup>();
    const uncategorized: VideoSummary[] = [];

    for (const video of videos) {
      const category = video.video_category;
      if (!category) {
        uncategorized.push(video);
        continue;
      }
      const bucket = buckets.get(category.id) ?? { category, videos: [] };
      bucket.videos.push(video);
      buckets.set(category.id, bucket);
    }

    const result = [...buckets.values()].sort((a, b) => {
      const aIndex = positionById.get(a.category!.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = positionById.get(b.category!.id) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.category!.name.localeCompare(b.category!.name);
    });

    if (uncategorized.length > 0) {
      result.push({ category: null, videos: uncategorized });
    }
    return result;
  }, [categories, videos]);

  return (
    <div className="page">
      <PageHeader
        title="Video Library"
        description={
          loading
            ? "Loading videos…"
            : `${videos.length} video${videos.length === 1 ? "" : "s"} across ${groups.length} section${
                groups.length === 1 ? "" : "s"
              }.`
        }
      >
        {canManage && !adding && (
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} /> Add video
          </button>
        )}
      </PageHeader>

      {adding && (
        <VideoCreateForm
          allowTagCreate={isAdmin}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {error && <div className="admin-error">{error}</div>}

      {!loading && !error && videos.length === 0 && (
        <EmptyState
          title="No videos yet"
          description={
            canManage
              ? "Add a video with the button above to start the library."
              : "Videos will appear here when a coach adds them."
          }
        />
      )}

      {groups.map((group) => (
        <section
          className="videos-section"
          key={group.category?.id ?? "uncategorized"}
          aria-label={group.category?.name ?? "Uncategorized"}
        >
          <h2 className="videos-section-title">
            {group.category?.name ?? "Uncategorized"}
            <span className="videos-section-count">{group.videos.length}</span>
          </h2>
          {group.category?.description && (
            <p className="videos-section-description">{group.category.description}</p>
          )}
          <div className="videos-grid">
            {group.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}