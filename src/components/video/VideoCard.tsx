import { Link } from "react-router-dom";
import type { VideoSummary } from "../../api";

interface VideoCardProps {
  video: VideoSummary;
  showTags?: boolean;
  maxTags?: number;
}

function TagChips({
  tags,
  max,
}: {
  tags?: { id: number; name: string }[];
  max?: number;
}) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, max ?? 3);
  const remaining = tags.length - (max ?? 3);
  return (
    <div className="video-card-tags">
      {shown.map((t) => (
        <span key={t.id} className="video-card-tag">
          {t.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="video-card-tag video-card-tag-more">+{remaining} more</span>
      )}
    </div>
  );
}

export default function VideoCard({ video, showTags = true, maxTags = 3 }: VideoCardProps) {
  return (
    <Link to={`/videos/${video.id}`} className="video-card-link">
      <div className="video-card">
        <div className="video-card-thumb">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt={video.title ?? ""} />
          ) : (
            <div className="video-card-thumb-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          )}
          <span className="video-card-provider">{video.provider_label}</span>
        </div>
        <div className="video-card-body">
          <h3 className="video-card-title">{video.title ?? "Untitled"}</h3>
          {showTags && <TagChips tags={video.video_tags} max={maxTags} />}
        </div>
      </div>
    </Link>
  );
}
