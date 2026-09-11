/** Ball — small independent, selectable circle. */

export interface BallProps {
  id: string;
  x: number;
  y: number;
  title: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export default function Ball({ id, x, y, title, onMouseEnter, onMouseLeave, onClick }: BallProps) {
  return (
    <g
      className="drill-ball"
      transform={`translate(${x}, ${y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <title>{title}</title>
      <circle r={6} className="drill-ball-shape" />
      <text textAnchor="middle" dy="0.35em" className="drill-ball-label">
        {id}
      </text>
    </g>
  );
}