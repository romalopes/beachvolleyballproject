import type { Drill } from '../api';
import { Users, ArrowRight } from 'lucide-react';
import { playerRangeLabel, idealLabel, trainingStageLabel } from '../utils/drills';

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
        <span className="drill-stat">
          <Users size={14} />
          {playerRangeLabel(drill.min_players, drill.max_players)}
        </span>
        <span className="drill-stat">{idealLabel(drill.ideal_num_players)}</span>
        <span className="drill-stat">{trainingStageLabel(drill.training_stage)}</span>
        <span className={`difficulty ${drill.difficulty_level}`}>
          {drill.difficulty_level}
        </span>
      </div>
      <div className="card-meta">
        <span className="home-section-link">
          View drill <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );
}

