import { useEffect, useState } from 'react';
import { api, type MediaAsset } from '../api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { PlayCircle } from 'lucide-react';

export default function Videos() {
  const [videos, setVideos] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.mediaAssets()
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
        <div className="video-grid">
          {videos.map((video) => (
            <div key={video.id} className="video-card">
              <div className="video-thumbnail">
                <PlayCircle size={24} color="var(--amber-500)" style={{ position: 'absolute' }} />
              </div>
              <div className="video-info">
                <h4>{video.title}</h4>
                <p>{video.asset_type === 'example_demo' ? 'Example Demo' : 'Training Clip'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
