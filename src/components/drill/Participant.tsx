/**
 * Participant — renders a player or coach at an SVG point.
 * Coaches are visually distinct from players.
 */

export interface ParticipantProps {
  id: string;
  type: string;
  x: number;
  y: number;
  title: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export default function Participant({ id, type, x, y, title, onMouseEnter, onMouseLeave, onClick }: ParticipantProps) {
  const isCoach = type !== "player";
  return (
    <g
      className={`drill-participant${isCoach ? " drill-participant-coach" : ""}`}
      transform={`translate(${x}, ${y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <title>{title}</title>
      {isCoach ? (
        <rect x={-9} y={-9} width={18} height={18} rx={3} className="drill-participant-shape" transform="rotate(45)" />
      ) : (
        <circle r={10} className="drill-participant-shape" />
      )}
      <text textAnchor="middle" dy="0.35em" className="drill-participant-label">
        {id}
      </text>
    </g>
  );
}