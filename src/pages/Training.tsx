import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type TrainingSession } from '../api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function Training() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.trainingSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Training"
        description="View training sessions that combine multiple drills and skills into structured practice plans."
      />

      {sessions.length === 0 ? (
        <EmptyState title="No training sessions" description="Training sessions will appear here when scheduled." />
      ) : (
        <div className="training-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="training-item"
              onClick={() => navigate(`/training/${session.id}`)}
            >
              <div className="training-item-info">
                <h4>{session.drill?.title || 'Training Session'}</h4>
                <p>{session.notes || session.location || 'No details'}</p>
              </div>
              <span className="training-item-date">{formatDate(session.scheduled_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
