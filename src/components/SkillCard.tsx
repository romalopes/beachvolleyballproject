import type { Skill } from '../api';
import { ArrowRight, Pencil } from 'lucide-react';

interface SkillCardProps {
  skill: Skill;
  onClick?: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
}

export default function SkillCard({ skill, onClick, isAdmin, onEdit }: SkillCardProps) {
  return (
    <div className="card skill-card" onClick={onClick}>
      {skill.category && (
        <div className="card-category">{skill.category.name}</div>
      )}
      <h3 className="card-title">{skill.title}</h3>
      {skill.description && (
        <p className="card-description">{skill.description}</p>
      )}
      <div className="card-meta">
        <span className="home-section-link">
          View skill <ArrowRight size={14} />
        </span>
        {isAdmin && onEdit && (
          <button
            className="card-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit skill"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

