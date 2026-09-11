/**
 * DrillObject — renders known object types with a dedicated representation
 * and unknown types with a generic fallback so rendering never breaks.
 */

export interface DrillObjectProps {
  type: string;
  x: number;
  y: number;
  title: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export default function DrillObject({ type, x, y, title, onMouseEnter, onMouseLeave, onClick }: DrillObjectProps) {
  const known = type === "cone";
  return (
    <g
      className="drill-object"
      transform={`translate(${x}, ${y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <title>{title}</title>
      {known ? (
        // cone: small triangle
        <polygon points="0,-8 7,6 -7,6" className="drill-object-shape" />
      ) : (
        // generic fallback: dashed square
        <rect x={-8} y={-8} width={16} height={16} rx={2} className="drill-object-fallback" />
      )}
      <text textAnchor="middle" dy="1.4em" className="drill-object-label">
        {type.slice(0, 4)}
      </text>
    </g>
  );
}