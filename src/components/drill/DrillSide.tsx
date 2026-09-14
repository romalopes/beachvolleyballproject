/**
 * DrillCourt — renders the two logical courts, the net, the 5x4 reference
 * grid (thin continuous lines, not boxes) and the extended areas.
 */

import type { CourtConfig, Orientation } from "./definition";
import { buildCourtGeometry, type CourtGeometry } from "./geometry";

interface DrillCourtProps {
  orientation: Orientation;
  court: CourtConfig;
}

export default function DrillCourt({ orientation, court }: DrillCourtProps) {
  const geometry: CourtGeometry = buildCourtGeometry(orientation, court);
  const { grid } = geometry;

  const renderCourt = (rect: CourtGeometry["court1"], label: string) => {
    const lateral = geometry.orientation === "lateral";
    const lines = [];
    // Column lines (constant x, sideline axis):
    //   top_down → vertical lines at screen-x;  lateral → horizontal lines at screen-y.
    for (let c = 1; c <= grid.columns; c++) {
      const f = (c - 1) / (grid.columns - 1);
      if (lateral) {
        const sy = rect.y + f * rect.height;
        lines.push(
          <line
            key={`c${label}${c}`}
            x1={rect.x}
            y1={sy}
            x2={rect.x + rect.width}
            y2={sy}
            className="drill-grid-line"
          />,
        );
      } else {
        const sx = rect.x + f * rect.width;
        lines.push(
          <line
            key={`c${label}${c}`}
            x1={sx}
            y1={rect.y}
            x2={sx}
            y2={rect.y + rect.height}
            className="drill-grid-line"
          />,
        );
      }
    }
    // Row lines (constant y, baseline→net axis):
    //   top_down → horizontal lines at screen-y;  lateral → vertical lines at screen-x.
    for (let r = 1; r <= grid.rows; r++) {
      const f = (r - 1) / (grid.rows - 1);
      if (lateral) {
        const sx = rect.x + f * rect.width;
        lines.push(
          <line
            key={`r${label}${r}`}
            x1={sx}
            y1={rect.y}
            x2={sx}
            y2={rect.y + rect.height}
            className="drill-grid-line"
          />,
        );
      } else {
        const sy = rect.y + f * rect.height;
        lines.push(
          <line
            key={`r${label}${r}`}
            x1={rect.x}
            y1={sy}
            x2={rect.x + rect.width}
            y2={sy}
            className="drill-grid-line"
          />,
        );
      }
    }
    return (
      <g>
        <rect {...rect} className="drill-court-boundary" />
        {lines}
        <text
          x={rect.x + rect.width / 2}
          y={rect.y - 8}
          textAnchor="middle"
          className="drill-court-label"
        >
          {label}
        </text>
      </g>
    );
  };

  /** Net band between the courts: rails (band border) + rung stripes + center mark. */
  const renderNet = () => {
    const n = geometry.net;
    const horizontal = geometry.orientation === "lateral";
    // Rungs every ~32 units, perpendicular to the band's long axis.
    const stripeCount = Math.max(
      0,
      Math.floor((horizontal ? n.width : n.height) / 32) - 1,
    );
    const stripes = Array.from({ length: stripeCount }, (_, i) => {
      const f = (i + 1) / (stripeCount + 1);
      return horizontal ? (
        <line
          key={`ns${i}`}
          x1={n.x + f * n.width}
          y1={n.y}
          x2={n.x + f * n.width}
          y2={n.y + n.height}
          className="drill-net-stripe"
        />
      ) : (
        <line
          key={`ns${i}`}
          x1={n.x}
          y1={n.y + f * n.height}
          x2={n.x + n.width}
          y2={n.y + f * n.height}
          className="drill-net-stripe"
        />
      );
    });
    // Center mark: slightly stronger rung at the net's midpoint.
    const midF = 0.5;
    const center = horizontal ? (
      <line
        x1={n.x + midF * n.width}
        y1={n.y}
        x2={n.x + midF * n.width}
        y2={n.y + n.height}
        className="drill-net-center"
      />
    ) : (
      <line
        x1={n.x}
        y1={n.y + midF * n.height}
        x2={n.x + n.width}
        y2={n.y + midF * n.height}
        className="drill-net-center"
      />
    );
    return (
      <g>
        <rect {...n} className="drill-net" />
        {stripes}
        {center}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className="drill-court-svg"
      role="img"
      aria-label="Drill courts"
    >
      {/* Extended areas (visually subordinate, dashed); only enabled sides exist. */}
      {Object.values(geometry.extensions)
        .filter(Boolean)
        .map((rect, i) => (
          <rect
            key={i}
            {...(rect as CourtGeometry["court1"])}
            className="drill-extended-area"
          />
        ))}

      {renderCourt(geometry.court1, "SIDE 1")}
      {renderCourt(geometry.court2, "SIDE 2")}

      {/* Net */}
      {renderNet()}
    </svg>
  );
}
