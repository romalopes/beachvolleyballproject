import { Link } from 'react-router-dom';
import type { TrainingFocus } from '../../api';
import EmptyState from '../EmptyState';

interface TrainingFocusListProps {
  focuses?: TrainingFocus[] | null;
}

export default function TrainingFocusList({ focuses }: TrainingFocusListProps) {
  const ordered = [...(focuses ?? [])].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) {
    return (
      <EmptyState title="No focuses yet" description="Focuses will appear here when added." />
    );
  }
  return (
    <ol className="training-focus-list">
      {ordered.map((focus, index) => (
        <li key={focus.id ?? `focus-${index}`} className="training-focus-item">
          <span className="training-focus-title">
            {index + 1}.{' '}
            {focus.skill ? (
              <Link to={`/skills/${focus.skill.slug}`}>{focus.skill.title}</Link>
            ) : (
              focus.custom_focus
            )}
          </span>
          {focus.skill?.category && (
            <span className="related-item-meta"> · {focus.skill.category.name}</span>
          )}
          {focus.description && <p>{focus.description}</p>}
        </li>
      ))}
    </ol>
  );
}
