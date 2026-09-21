/**
 * TextAnnotation — an annotation overlay: arbitrary coach-authored text
 * (possibly multi-line) anchored at a LOGICAL `Location` (side + grid x/y) —
 * the exact coordinate system players use.
 *
 * `locationToSvg` projects the anchor identically to a player position, so
 * flipping lateral ⇄ top_down keeps the text at the same spot of the court
 * (relative to the net and the sidelines) instead of relocating it.
 *
 * The box extends right/down from the anchor in screen space, so the text
 * always renders upright; `width`/`height` are fractions of the anchored
 * side's rect (screen-space box size). Rendered as an SVG <foreignObject> so
 * the HTML content (wrapping, formatting, background, border) scales with the
 * court viewBox at every canvas size. In read-only mode it is
 * pointer-transparent.
 */
import { locationToSvg, type SideGeometry } from "./geometry";
import type { TextAnnotation } from "./definition";

export interface TextAnnotationMarkProps {
  annotation: TextAnnotation;
  /** Court geometry the logical anchor is projected with. */
  geometry: SideGeometry;
  selected?: boolean;
  onPointerDown?: (event: React.PointerEvent) => void;
}

export default function TextAnnotationMark({
  annotation,
  geometry,
  selected = false,
  onPointerDown,
}: TextAnnotationMarkProps) {
  const rect =
    annotation.location.side === "side_2" ? geometry.side2 : geometry.side1;
  // The box's anchor, projected exactly like a player position.
  const anchor = locationToSvg(annotation.location, geometry);
  const w = Math.max(annotation.width * rect.width, 1);
  const h = Math.max(annotation.height * rect.height, 1);
  const fontSize = annotation.font_size ?? 14;
  const lines = (annotation.text ?? "").split("\n");

  return (
    <foreignObject
      x={anchor.x}
      y={anchor.y}
      width={w}
      height={h}
      className={`drill-annotation${selected ? " drill-annotation-selected" : ""}`}
      style={{ overflow: "visible", pointerEvents: onPointerDown ? "auto" : "none" }}
      onPointerDown={onPointerDown}
      data-annotation-id={annotation.id}
    >
      <div
        className={[
          "drill-annotation-box",
          annotation.background ? "drill-annotation-bg" : "",
          annotation.border ? "drill-annotation-border" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          width: "100%",
          height: "100%",
          fontSize: `${fontSize}px`,
          fontWeight: annotation.bold ? "bold" : "normal",
          fontStyle: annotation.italic ? "italic" : "normal",
          textAlign: annotation.align ?? "left",
          overflow: "hidden",
          cursor: onPointerDown ? "move" : "default",
          userSelect: "none",
          padding: "2px 4px",
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ lineHeight: 1.25 }}>
            {line === "" ? "\u00a0" : line}
          </div>
        ))}
      </div>
    </foreignObject>
  );
}