import { ExternalLink } from "lucide-react";
import type { VideoReference } from "../../api";
import { formatReferenceWindow } from "../../utils/videos";
import VideoProviderBadge from "./VideoProviderBadge";

/**
 * Renders one video reference.
 *
 * Embedding is decided by the backend (`can_embed` + `embed_url`, built from
 * an allowlisted host): when present we render the provider's iframe lazily;
 * otherwise a thumbnail (or a generic placeholder) plus a "Watch on …" link —
 * never a broken iframe. No provider-specific logic lives here.
 */
export default function VideoPlayer({ reference }: { reference: VideoReference }) {
  const { video } = reference;
  const window = formatReferenceWindow(reference.start_seconds, reference.end_seconds);
  const caption = reference.title || video.title || "Video";

  return (
    <figure className="video-card">
      {reference.can_embed && reference.embed_url ? (
        <iframe
          className="video-embed"
          src={reference.embed_url}
          title={caption}
          loading="lazy"
          allowFullScreen
        />
      ) : (
        <a
          className="video-fallback"
          href={reference.external_url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt={caption} />
          ) : (
            <span className="video-placeholder">▶</span>
          )}
        </a>
      )}
      <figcaption className="video-card-meta">
        <span className="video-card-title">{caption}</span>
        {window && <span className="video-window">{window}</span>}
        <VideoProviderBadge label={video.provider_label} />
        <a
          className="video-watch-link"
          href={reference.external_url}
          target="_blank"
          rel="noreferrer noopener"
        >
          Watch on {video.provider_label} <ExternalLink size={14} />
        </a>
      </figcaption>
    </figure>
  );
}
