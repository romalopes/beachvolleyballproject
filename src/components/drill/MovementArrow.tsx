/** MovementArrow — visualises from → to with a thin arrow. */

export interface MovementArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: "participant" | "ball" | "object";
  title?: string;
}

export default function MovementArrow({ from, to, kind, title }: MovementArrowProps) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLen = 10;
  const shrink = 12; // stop short of the entity so the arrow doesn't overlap it
  const endX = to.x - Math.cos(angle) * shrink;
  const endY = to.y - Math.sin(angle) * shrink;
  const p1 = { x: endX - headLen * Math.cos(angle - Math.PI / 7), y: endY - headLen * Math.sin(angle - Math.PI / 7) };
  const p2 = { x: endX - headLen * Math.cos(angle + Math.PI / 7), y: endY - headLen * Math.sin(angle + Math.PI / 7) };

  return (
    <g className={`drill-movement drill-movement-${kind}`}>
      {title && <title>{title}</title>}
      <line x1={from.x} y1={from.y} x2={endX} y2={endY} className="drill-movement-line" />
      <polygon
        points={`${endX},${endY} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
        className="drill-movement-head"
      />
    </g>
  );
}