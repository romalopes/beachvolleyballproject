import { useEffect, useState } from 'react';
import { ExternalLink, PlayCircle, Plus } from 'lucide-react';
import { api, type VideoSummary } from '../api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import VideoCreateForm from '../components/video/VideoCreateForm';
import VideoProviderBadge from '../components/video/VideoProviderBadge';

/**
 * Public video library. A Video is the media resource; the page shows where
 * it is referenced (Drill/Skill) and a safe "Watch on [Provider]" action —
 * no inline iframe here, to keep the page light. Coaches/admins can create
 * standalone videos ("for later") here; they are attached to drills,
 * skills or trainings afterwards via "Choose from library".
 */
export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  /** The one library video currently playing inline (never several iframes). */
  const [playingId, setPlayingId] = useState<number | null>(null);
  const canManage = user?.roles?.some((role) => role === 'coach' || role === 'admin') ?? false;

  const load = () =>
    api.videos()
      .then(setVideos)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Videos"
        description="Watch skill demonstrations, drill walkthroughs, and training footage."
      />

      {canManage && !adding && (
        <div className="admin-table-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add video
          </button>
        </div>
      )}
      {adding && (
        <VideoCreateForm
          onSaved={() => {
            setAdding(false);
            load();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {videos.length === 0 ? (
        <EmptyState title="No videos available" description="Videos will appear here when added to the library." />
      ) : (
        <div className="videos-grid">
          {videos.map((video) => {
            const playing = playingId === video.id && video.can_embed && !!video.embed_url;
            return (
              <div key={video.id} className="videos-card">
                <div className="videos-thumbnail">
                  {playing ? (
                    <iframe
                      className="video-embed"
                      src={video.embed_url ?? undefined}
                      title={video.title || "Video"}
                      loading="lazy"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title ?? 'Video'} />
                      ) : (
                        <PlayCircle size={24} color="var(--amber-500)" style={{ position: 'absolute' }} />
                      )}
                      {video.can_embed && video.embed_url && (
                        <button
                          type="button"
                          className="videos-play"
                          aria-label={`Play ${video.title || 'video'}`}
                          onClick={() => setPlayingId(video.id)}
                        >
                          ▶
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="videos-info">
                  <h4>{video.title || 'Untitled video'}</h4>
                  <p>
                    <VideoProviderBadge label={video.provider_label} />
                    {video.reference_count > 0 &&
                      ` · used in ${video.reference_count} place${video.reference_count === 1 ? '' : 's'}`}
                  </p>
                  <p className="videos-links">
                    {playing && (
                      <button type="button" onClick={() => setPlayingId(null)}>
                        Stop
                      </button>
                    )}
                    <a href={video.external_url} target="_blank" rel="noreferrer noopener">
                      Watch on {video.provider_label} <ExternalLink size={13} />
                    </a>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
