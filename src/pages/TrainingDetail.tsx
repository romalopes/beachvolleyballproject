import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type TrainingSession } from '../api';
import EmptyState from '../components/EmptyState';

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.trainingSession(Number(id))
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!session) return <EmptyState title="Training session not found" />;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate('/training')}>
          Back to Training
        </button>
        <h1>{session.drill?.title || 'Training Session'}</h1>
      </div>

      <section className="detail-section">
        <h2>Session Details</h2>
        <p>
          <strong>Scheduled:</strong> {formatDate(session.scheduled_at)}
          <br />
          {session.location && (
            <>
              <strong>Location:</strong> {session.location}
            </>
          )}
        </p>
      </section>

      {session.notes && (
        <section className="detail-section">
          <h2>Notes</h2>
          <p>{session.notes}</p>
        </section>
      )}

      {session.drill && (
        <section className="detail-section">
          <h2>Related Drill</h2>
          <Link to={`/drills/${session.drill.id}`} className="related-item">
            <span className="related-item-title">{session.drill.title}</span>
            <span className="related-item-meta">{session.drill.difficulty_level}</span>
          </Link>
        </section>
      )}
    </div>
  );
}
