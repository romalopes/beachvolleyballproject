import { useEffect, useState } from 'react';
import { api, type TrainingSession } from '../api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { MapPin } from 'lucide-react';

export default function Schedule() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.trainingSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

      {sessions.length === 0 ? (
        <EmptyState title="No scheduled sessions" description="Training sessions will appear here when scheduled." />
      ) : (
        <div className="schedule-list">
          {sessions.map((session) => {
            const date = formatDate(session.scheduled_at);
            return (
              <div key={session.id} className="schedule-item">
                <div className="schedule-date">
                  <span className="schedule-day">{date.day}</span>
                  <span className="schedule-month">{date.month}</span>
                </div>
                <div className="schedule-info">
                  <h4>{session.drill?.title || 'Training Session'}</h4>
                  <p>
                    <MapPin size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                    {session.location || 'No location'} &middot; {date.weekday} at {date.time}
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
