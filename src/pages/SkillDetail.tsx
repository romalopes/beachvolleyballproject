import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Skill, type Drill } from '../api';
import EmptyState from '../components/EmptyState';

export default function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [relatedDrills, setRelatedDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.skill(Number(id))
      .then((s) => {
        setSkill(s);
        return api.drills();
      })
      .then((drills) => {
        setRelatedDrills(drills);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!skill) return <EmptyState title="Skill not found" />;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate('/skills')}>
          Back to Skills
        </button>
        <h1>{skill.title}</h1>
        {skill.category && (
          <span className="card-tag">{skill.category.name}</span>
        )}
      </div>

      <section className="detail-section">
        <h2>Description</h2>
        <p>{skill.description || 'No description available.'}</p>
      </section>

      <section className="detail-section">
        <h2>Related Drills</h2>
        {relatedDrills.length === 0 ? (
          <EmptyState title="No drills linked" description="Drills will appear here when associated with this skill." />
        ) : (
          <div className="related-list">
            {relatedDrills.map((drill) => (
              <Link
                key={drill.id}
                to={`/drills/${drill.id}`}
                className="related-item"
              >
                <span className="related-item-title">{drill.title}</span>
                <span className="related-item-meta">
                  {drill.difficulty_level} &middot; {drill.player_count} players
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
