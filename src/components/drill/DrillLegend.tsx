/**
 * DrillLegend — legend of every participant, ball and object in the drill
 * definition. Reuses the real entity components as swatches so shapes,
 * colors and labels always match the court rendering.
 */

import type { ReactNode } from "react";
import type { DrillDefinition } from "./definition";
import Participant from "./Participant";
import Ball from "./Ball";
import DrillObject from "./DrillObject";

interface DrillLegendProps {
  definition: DrillDefinition;
}

/** Swatch SVG hosting an entity component with the same visuals as the court. */
function LegendSwatch({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <svg viewBox="-14 -14 28 32" width={30} height={30} className="drill-legend-swatch" aria-hidden="true">
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export default function DrillLegend({ definition }: DrillLegendProps) {
  if (!definition) return null;

  const participants = definition.participants ?? [];
  const balls = definition.balls ?? [];
  const objects = definition.objects ?? [];

  // Objects are labeled by type on the court, so the legend groups instances
  // by type instead of listing every id individually.
  const objectTypes = objects.reduce<{ type: string; count: number; description?: string }[]>(
    (acc, o) => {
      const existing = acc.find((t) => t.type === o.type);
      if (existing) existing.count += 1;
      else acc.push({ type: o.type, count: 1, description: o.description });
      return acc;
    },
    []
  );

  if (participants.length === 0 && balls.length === 0 && objectTypes.length === 0) {
    return null;
  }

  return (
    <div className="drill-legend">
      {participants.length > 0 && (
        <div className="drill-legend-group">
          <span className="drill-legend-group-title">Participants</span>
          <div className="drill-legend-items">
            {participants.map((p) => (
              <span key={p.id} className="drill-legend-item" title={p.description}>
                <LegendSwatch title={p.description}>
                  <Participant id={p.id} type={p.type} x={0} y={0} title={p.description ?? p.id} />
                </LegendSwatch>
                <span className="drill-legend-text">
                  <strong>{p.id}</strong> {p.role ?? p.type}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {balls.length > 0 && (
        <div className="drill-legend-group">
          <span className="drill-legend-group-title">Balls</span>
          <div className="drill-legend-items">
            {balls.map((b) => (
              <span key={b.id} className="drill-legend-item" title={b.description}>
                <LegendSwatch title={b.description}>
                  <Ball id={b.id} x={0} y={0} title={b.description ?? b.id} />
                </LegendSwatch>
                <span className="drill-legend-text">
                  <strong>{b.id}</strong> {b.type}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {objectTypes.length > 0 && (
        <div className="drill-legend-group">
          <span className="drill-legend-group-title">Objects</span>
          <div className="drill-legend-items">
            {objectTypes.map(({ type, count, description }) => (
              <span key={type} className="drill-legend-item" title={description}>
                <LegendSwatch title={description}>
                  <DrillObject type={type} x={0} y={0} title={description ?? type} />
                </LegendSwatch>
                <span className="drill-legend-text">
                  {type}
                  {count > 1 ? ` ×${count}` : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
