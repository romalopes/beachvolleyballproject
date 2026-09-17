import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Plus } from 'lucide-react';
import { api, type TrainingSession } from '../api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Tag from '../components/Tag';
import { canManageTrainings, formatTrainingTime, statusLabel } from '../utils/training';

export default function Training() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageTrainings(user);

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
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Training"
        description="Shared training sessions that combine focuses and drills into structured practice plans."
      >
        {canManage && (
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => navigate('/training/new')}
          >
            <Plus size={16} />
            New Training
          </button>
        )}
      </PageHeader>

      {sessions.length === 0 ? (
        <EmptyState title="No training sessions" description="Training sessions will appear here when scheduled." />
      ) : (
        <div className="training-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`training-item${session.status === 'cancelled' ? ' training-cancelled' : ''}`}
              onClick={() => navigate(`/training/${session.id}`)}
            >
              <div className="training-item-info">
                <h4>{session.title}</h4>
                <p>
                  <CalendarDays size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                  {formatDate(session.starts_at)}
                  {session.location && (
                    <>
                      {' · '}
                      <MapPin size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                      {session.location}
                    </>
                  )}
                </p>
              </div>
              <span className="training-item-meta">
                <Tag>{statusLabel(session.status)}</Tag>
                <span className="training-item-date">
                  <Clock size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                  {formatTrainingTime(session.starts_at, session.ends_at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
