import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Drill } from '../api';
import EmptyState from '../components/EmptyState';

export default function DrillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.drill(Number(id))
      .then(setDrill)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!drill) return <EmptyState title="Drill not found" />;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate('/drills')}>
          Back to Drills
        </button>
        <h1>{drill.title}</h1>
        <div className="tags" style={{ marginTop: '1rem' }}>
          {drill.difficulty_level && <span className="tag">{drill.difficulty_level}</span>}
          {drill.player_count && <span className="tag">{drill.player_count} players</span>}
        </div>
      </div>

      <section className="detail-section">
        <h2>Setup Instructions</h2>
        <p>{drill.setup_instructions || 'No instructions available.'}</p>
      </section>

      <section className="detail-section">
        <h2>Related Skills</h2>
        {!drill.skills || drill.skills.length === 0 ? (
          <EmptyState title="No skills linked" description="Skills will appear here when associated with this drill." />
        ) : (
          <div className="related-list">
            {drill.skills.map((skill) => (
              <Link
                key={skill.id}
                to={`/skills/${skill.id}`}
                className="related-item"
              >
                <span className="related-item-title">{skill.title}</span>
                <span className="related-item-meta">{skill.category?.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
