import { useEffect, useState } from 'react';
import { ExternalLink, PlayCircle } from 'lucide-react';
import { api, type VideoSummary } from '../api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import VideoProviderBadge from '../components/video/VideoProviderBadge';

/**
 * Public video library. A Video is the media resource; the page shows where
 * it is referenced (Drill/Skill) and a safe "Watch on [Provider]" action —
 * no inline iframe here, to keep the page light.
 */
export default function Videos() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.videos()
      .then(setVideos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Videos"
        description="Watch skill demonstrations, drill walkthroughs, and training footage."
      />

      {videos.length === 0 ? (
        <EmptyState title="No videos available" description="Videos will appear here when added to the library." />
      ) : (
        <div className="videos-grid">
          {videos.map((video) => (
            <div key={video.id} className="videos-card">
              <div className="videos-thumbnail">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title ?? 'Video'} />
                ) : (
                  <PlayCircle size={24} color="var(--amber-500)" style={{ position: 'absolute' }} />
                )}
              </div>
              <div className="videos-info">
                <h4>{video.title || 'Untitled video'}</h4>
                <p>
                  <VideoProviderBadge label={video.provider_label} />
                  {video.reference_count > 0 &&
                    ` · used in ${video.reference_count} place${video.reference_count === 1 ? '' : 's'}`}
                </p>
                <a href={video.external_url} target="_blank" rel="noreferrer noopener">
                  Watch on {video.provider_label} <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
