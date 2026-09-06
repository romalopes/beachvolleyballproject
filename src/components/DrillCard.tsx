import type { Drill } from '../api';

interface DrillCardProps {
  drill: Drill;
  onClick?: () => void;
}

export default function DrillCard({ drill, onClick }: DrillCardProps) {
  return (
    <div className="card drill-card" onClick={onClick}>
      <h3 className="card-title">{drill.title}</h3>
      {drill.setup_instructions && (
        <p className="card-description">{drill.setup_instructions}</p>
      )}
      <div className="drill-stats">
        {drill.player_count && (
          <span className="drill-stat">{drill.player_count} players</span>
        )}
        {drill.difficulty_level && (
          <span className={`difficulty ${drill.difficulty_level}`}>
            {drill.difficulty_level}
          </span>
        )}
      </div>
    </div>
  );
}

