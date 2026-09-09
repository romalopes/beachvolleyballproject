import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Drill } from "../api";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import { ArrowLeft, Target, Users } from "lucide-react";
import {
  idealLabel,
  isValidDrillRange,
  trainingStageLabel,
} from "../utils/drills";

export default function DrillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .drill(id)
      .then(setDrill)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!drill) return <EmptyState title="Drill not found" />;
  if (!isValidDrillRange(drill)) {
    return (
      <EmptyState
        title="Incomplete drill data"
        description="This drill is missing required training attributes."
      />
    );
  }

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/drills")}>
          <ArrowLeft size={16} />
          Back to Drills
        </button>
        <span className="section-label">Drill</span>
        <h1>{drill.title}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag variant="primary">Drill</Tag>
          <Tag variant="teal">{drill.difficulty_level}</Tag>
          <Tag>{trainingStageLabel(drill.training_stage)}</Tag>
          <Tag>
            <Users
              size={12}
              style={{ marginRight: "0.25rem", verticalAlign: "middle" }}
            />
            Min: {drill.min_players} · Max: {drill.max_players}
          </Tag>
          <Tag>{idealLabel(drill.ideal_num_players)}</Tag>
        </div>
      </div>

      <section className="detail-section">
        <h2>Setup Instructions</h2>
        <p>{drill.setup_instructions || "No instructions available."}</p>
      </section>

      <section className="detail-section">
        <h2>Related Skills</h2>
        {!drill.skills || drill.skills.length === 0 ? (
          <EmptyState
            title="No skills linked"
            description="Skills will appear here when associated with this drill."
          />
        ) : (
          <div className="related-list">
            {drill.skills.map((skill) => (
              <Link
                key={skill.id}
                to={`/skills/${skill.slug}`}
                className="related-item"
              >
                <span className="related-item-title">
                  <Target
                    size={16}
                    style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
                  />
                  {skill.title}
                </span>
                <span className="related-item-meta">
                  {skill.category?.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
