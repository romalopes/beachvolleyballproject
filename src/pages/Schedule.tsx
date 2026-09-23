import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type TrainingSession } from '../api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Tag from '../components/Tag';
import { CalendarCheck, MapPin } from 'lucide-react';
import { isPrivateSession, statusLabel } from '../utils/training';

export default function Schedule() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  // "My schedule" (mine=1): only the sessions the signed-in player takes part
  // in. The server answers with an empty list for accounts that have no player
  // profile, so this needs no role logic on the client.
  const [mine, setMine] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .trainingSessions({ mine })
      .then((loaded) => {
        if (cancelled) return;
        setSessions(loaded);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mine]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      time: date.toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Schedule"
        description="Upcoming training sessions and practice calendar."
      />

      {user && (
        <div className="schedule-filter">
          <label className="schedule-mine">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => setMine(event.target.checked)}
            />
            <CalendarCheck size={14} aria-hidden="true" />
            My schedule only
          </label>
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title={mine ? 'No sessions for you yet' : 'No scheduled sessions'}
          description={
            mine
              ? 'Trainings you are added to will appear here.'
              : 'Training sessions will appear here when scheduled.'
          }
        />
      ) : (
        <div className="schedule-list">
          {sessions.map((session) => {
            const date = formatDate(session.starts_at);
            return (
              <div
                key={session.id}
                className={`schedule-item${session.status === 'cancelled' ? ' training-cancelled' : ''}`}
                onClick={() => navigate(`/training/${session.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="schedule-date">
                  <span className="schedule-day">{date.day}</span>
                  <span className="schedule-month">{date.month}</span>
                </div>
                <div className="schedule-info">
                  <h4>{session.title}</h4>
                  <p>
                    <MapPin size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                    {session.location || 'No location'} &middot; {date.weekday} at {date.time}
                  </p>
                  <Tag>{statusLabel(session.status)}</Tag>
                  {isPrivateSession(session) && <Tag>Private</Tag>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
