import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Skill, type Drill } from '../api';
import EmptyState from '../components/EmptyState';
import Tag from '../components/Tag';
import { ArrowLeft, Dumbbell } from 'lucide-react';

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
        setRelatedDrills(drills.filter((d) => d.skills?.some((s) => s.id === Number(id))));
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
          <ArrowLeft size={16} />
          Back to Skills
        </button>
        <span className="section-label">{skill.category?.name}</span>
        <h1>{skill.title}</h1>
        <div className="tags" style={{ marginTop: '1rem' }}>
          <Tag variant="primary">Skill</Tag>
          {skill.category && <Tag>{skill.category.name}</Tag>}
        </div>
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
                <span className="related-item-title">
                  <Dumbbell size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  {drill.title}
                </span>
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
