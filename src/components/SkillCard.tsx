import type { Skill } from '../api';

interface SkillCardProps {
  skill: Skill;
  onClick?: () => void;
}

export default function SkillCard({ skill, onClick }: SkillCardProps) {
  return (
    <div className="card skill-card" onClick={onClick}>
      {skill.category && (
        <div className="card-category">{skill.category.name}</div>
      )}
      <h3 className="card-title">{skill.title}</h3>
      {skill.description && (
        <p className="card-description">{skill.description}</p>
      )}
    </div>
  );
}

