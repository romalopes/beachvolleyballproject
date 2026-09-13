import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type Skill, type Drill } from '../api';
import EmptyState from '../components/EmptyState';
import Tag from '../components/Tag';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirm from '../components/settings/DeleteConfirm';
import ResourceTable from '../components/settings/ResourceTable';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { isValidDrillRange, playerRangeLabel, trainingStageLabel } from '../utils/drills';

export default function SkillDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [allDrills, setAllDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = user?.roles?.includes('admin');

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.skill(slug),
      api.drills().catch(() => [] as Drill[]),
    ])
      .then(([s, drills]) => {
        setSkill(s);
        setAllDrills(drills);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const skillDrills = useMemo(
    () => allDrills.filter((d) => isValidDrillRange(d) && d.skills?.some((s) => s.slug === skill?.slug)),
    [allDrills, skill]
  );

  const handleDelete = async () => {
    if (!skill) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroySkill(skill.id);
      navigate('/skills');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete skill.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">{error}</div>
      </div>
    );
  }
  if (!skill) return <EmptyState title="Skill not found" />;

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="section-label">{skill.category?.name}</span>
        <h1>{skill.title}</h1>
        <div className="tags" style={{ marginTop: '1rem' }}>
          <Tag variant="primary">Skill</Tag>
          {skill.category && <Tag>{skill.category.name}</Tag>}
        </div>
      </div>

      {isAdmin && (
        <div className="admin-actions-bar">
          <div className="admin-table-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate(`/settings/skills/${skill.slug}/edit`)}
            >
              Edit
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <DeleteConfirm
          entityName={skill.title}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}

      <section className="detail-section">
        <h2>Description</h2>
        <p>{skill.description || 'No description available.'}</p>
      </section>

      <section className="detail-section">
        <h2>Related Drills</h2>
        {skillDrills.length === 0 ? (
          <EmptyState title="No drills linked" description="Drills will appear here when associated with this skill." />
        ) : (
          <ResourceTable<Drill>
            data={skillDrills}
            emptyTitle="No drills linked"
            emptyDescription="Drills will appear here when associated with this skill."
            columns={[
              {
                key: "title",
                label: "Name",
                render: (d) => (
                  <Link to={`/drills/${d.slug}`} className="admin-table-name">
                    <Dumbbell size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {d.title}
                  </Link>
                ),
              },
              { key: "stage", label: "Stage", render: (d) => trainingStageLabel(d.training_stage) },
              { key: "difficulty", label: "Difficulty", render: (d) => d.difficulty_level },
              {
                key: "players",
                label: "Players",
                render: (d) => playerRangeLabel(d.min_players, d.max_players),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
