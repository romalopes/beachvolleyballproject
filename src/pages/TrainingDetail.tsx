import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type TrainingSession } from '../api';
import EmptyState from '../components/EmptyState';
import Tag from '../components/Tag';
import { ArrowLeft, CalendarDays, MapPin, Dumbbell, Target } from 'lucide-react';
import {
  idealLabel,
  isValidDrillRange,
  playerRangeLabel,
  trainingStageLabel,
} from '../utils/drills';

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
          <ArrowLeft size={16} />
          Back to Training
        </button>
        <span className="section-label">Training Session</span>
        <h1>{session.drill?.title || 'Training Session'}</h1>
        <div className="tags" style={{ marginTop: '1rem' }}>
          <Tag variant="primary">Session</Tag>
          {session.drill && isValidDrillRange(session.drill) && (
            <>
              <Tag variant="teal">{session.drill.difficulty_level}</Tag>
              <Tag>{trainingStageLabel(session.drill.training_stage)}</Tag>
              <Tag>{playerRangeLabel(session.drill.min_players, session.drill.max_players)}</Tag>
              <Tag>{idealLabel(session.drill.ideal_num_players)}</Tag>
            </>
          )}
        </div>
      </div>

      <section className="detail-section">
        <h2>Session Details</h2>
        <p>
          <CalendarDays size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          <strong>Scheduled:</strong> {formatDate(session.scheduled_at)}
          <br />
          {session.location && (
            <>
              <MapPin size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
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
            <span className="related-item-title">
              <Dumbbell size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              {session.drill.title}
            </span>
            <span className="related-item-meta">
              {session.drill.difficulty_level} &middot; {playerRangeLabel(session.drill.min_players, session.drill.max_players)} &middot; {trainingStageLabel(session.drill.training_stage)}
            </span>
          </Link>
        </section>
      )}

      {session.drill?.skills && session.drill.skills.length > 0 && (
        <section className="detail-section">
          <h2>Skills in this Session</h2>
          <div className="related-list">
            {session.drill.skills.map((skill) => (
              <Link key={skill.id} to={`/skills/${skill.id}`} className="related-item">
                <span className="related-item-title">
                  <Target size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  {skill.title}
                </span>
                <span className="related-item-meta">{skill.category?.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
