import { Link } from 'react-router-dom';
import { Clock, Dumbbell, Target } from 'lucide-react';
import type { Drill, TrainingSessionDrillRow } from '../../api';
import { resolveDrillDefinition } from '../drill/definition';
import DrillViewer from '../drill/DrillViewer';
import EmptyState from '../EmptyState';

function formatDuration(minutes: number | null): string {
  if (minutes == null) return 'Duration not set';
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function DrillSteps({ drill }: { drill: Drill }) {
  const definition = resolveDrillDefinition(drill.definition);
  const steps = definition?.steps ?? [];
  if (steps.length === 0) return null;
  return (
    <ol className="training-drill-steps">
      {steps.map((step, index) => (
        <li key={step.id || index}>
          <strong>Step {index + 1}</strong>
          {step.description ? `: ${step.description}` : ''}
        </li>
      ))}
    </ol>
  );
}

interface TrainingDrillListProps {
  drills?: TrainingSessionDrillRow[] | null;
}

export default function TrainingDrillList({ drills }: TrainingDrillListProps) {
  const ordered = [...(drills ?? [])].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) {
    return (
      <EmptyState title="No drills yet" description="Drills will appear here when added." />
    );
  }
  return (
    <div className="training-drill-list">
      {ordered.map((row, index) => {
        const drill = row.drill;
        if (!drill) return null;
        const definition = resolveDrillDefinition(drill.definition);
        return (
          <article key={row.id ?? `drill-${index}`} className="training-drill">
            <h3>
              {index + 1}. <Link to={`/drills/${drill.slug}`}>{drill.title}</Link>
            </h3>
            <p className="training-drill-meta">
              <Clock size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              {formatDuration(row.duration_minutes)}
            </p>
            {row.notes && (
              <p className="training-drill-notes">
                <strong>Notes:</strong> {row.notes}
              </p>
            )}
            {drill.setup_instructions && <p>{drill.setup_instructions}</p>}
            {definition ? (
              <DrillViewer definition={definition} />
            ) : (
              <EmptyState title="No visualisation yet" />
            )}
            <h4>Steps</h4>
            <DrillSteps drill={drill} />
            {drill.skills && drill.skills.length > 0 && (
              <div className="tags">
                {drill.skills.map((skill) => (
                  <span key={skill.id} className="tag">
                    <Target size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                    {skill.title}
                  </span>
                ))}
              </div>
            )}
            <p className="related-item-meta">
              <Dumbbell size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              <Link to={`/drills/${drill.slug}`}>Open full drill</Link>
            </p>
          </article>
        );
      })}
    </div>
  );
}
