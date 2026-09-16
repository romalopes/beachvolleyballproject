/**
 * LocationFields — numeric side/x/y editor for one placed entity or movement
 * endpoint. Drags stay the fast path on the court; these fields are the
 * precise path (a 20×10 grid cannot be authored exactly by pointer alone).
 * Commits on blur/Enter; invalid input is rejected, never written. Bounds come
 * from the definition's own grid via `editorBounds` (the Rails rule), so a
 * typed coordinate can never produce an unsaveable definition.
 */

import { useState } from "react";
import type { Location, SideId } from "../../../drill/definition";
import { editorBounds } from "../../../drill/geometry";
import type { DrillDefinition } from "../../../drill/definition";

export interface LocationFieldsProps {
  location: Location | undefined;
  legend: string;
  definition: DrillDefinition;
  onCommit: (location: Location) => void;
}

export default function LocationFields({
  location,
  legend,
  definition,
  onCommit,
}: LocationFieldsProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const bounds = editorBounds(definition.side);
  const shown = location ?? { side: "side_1" as SideId, x: 1, y: 1 };

  const commitField = (field: "side" | "x" | "y", raw: string) => {
    if (field === "side") {
      if (raw !== "side_1" && raw !== "side_2") return;
      onCommit({ ...shown, side: raw });
      return;
    }
    if (raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isInteger(value)) return;
    const side = bounds[shown.side];
    if (!side) return;
    const min = field === "x" ? side.minX : side.minY;
    const max = field === "x" ? side.maxX : side.maxY;
    if (value < min || value > max) return;
    onCommit({ ...shown, [field]: value });
    setDraft(null);
  };

  return (
    <fieldset className="drill-location-fields">
      <legend>{legend}</legend>
      <label>
        Side
        <select
          aria-label={`${legend} side`}
          value={shown.side}
          onChange={(event) => commitField("side", event.target.value)}
        >
          <option value="side_1">S1</option>
          <option value="side_2">S2</option>
        </select>
      </label>
      <label>
        X
        <input
          type="number"
          step={1}
          aria-label={`${legend} x`}
          value={draft ?? String(shown.x)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commitField("x", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter")
              commitField("x", event.currentTarget.value);
          }}
        />
      </label>
      <label>
        Y
        <input
          type="number"
          step={1}
          aria-label={`${legend} y`}
          value={draft ?? String(shown.y)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commitField("y", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter")
              commitField("y", event.currentTarget.value);
          }}
        />
      </label>
    </fieldset>
  );
}
