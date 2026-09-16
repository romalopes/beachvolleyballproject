/**
 * CourtSetup — the court-shape controls of the visual builder.
 *
 * Grid size (columns/rows) and the extended-area flags live here, at the top
 * of the configuration pane so the sticky court stays usable while tuning.
 * Every edit goes through `setGrid`/`setExtendedArea`, which pull placements
 * inside the new Rails bounds and report what moved — shrinking the court can
 * never silently strand a placement outside it.
 */

import { useState } from "react";
import type {
  DrillDefinition,
  ExtendedArea,
  Orientation,
} from "../../../drill/definition";
import {
  setExtendedArea,
  setGrid,
  setViewOrientation,
  type CourtEdit,
} from "./drill-model";

export interface CourtSetupProps {
  definition: DrillDefinition;
  onChange: (next: DrillDefinition) => void;
}

const EXTENSION_FLAGS: {
  key: "left" | "right" | "side_1" | "side_2";
  label: string;
}[] = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "side_1", label: "Side 1 baseline" },
  { key: "side_2", label: "Side 2 baseline" },
];

/** Human-readable report of what a court-shape edit had to move. */
function reportText(edit: CourtEdit): string | null {
  const { movedPlacements, movedTargets } = edit;
  if (movedPlacements === 0 && movedTargets === 0) return null;
  const parts: string[] = [];
  if (movedPlacements > 0) {
    parts.push(
      `${movedPlacements} placement${movedPlacements === 1 ? "" : "s"} moved inside the new bounds.`,
    );
  }
  if (movedTargets > 0) {
    parts.push(
      `${movedTargets} movement target${movedTargets === 1 ? "" : "s"} moved inside the new bounds.`,
    );
  }
  return parts.join(" ");
}

export default function CourtSetup({ definition, onChange }: CourtSetupProps) {
  const [report, setReport] = useState<string | null>(null);
  const { columns, rows } = definition.side.grid;
  const area: ExtendedArea = definition.side.extended_area ?? {
    enabled: false,
  };

  const commit = (edit: CourtEdit) => {
    onChange(edit.definition);
    setReport(reportText(edit));
  };

  /** Grid inputs are text so an intermediate blank is editable; only a valid
   * integer ≥ 1 is written (invalid input is rejected, not clamped). */
  const handleGrid = (field: "columns" | "rows", raw: string) => {
    if (raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) return;
    commit(
      setGrid(definition, {
        columns: field === "columns" ? value : columns,
        rows: field === "rows" ? value : rows,
      }),
    );
  };

  const handleEnabled = (enabled: boolean) => {
    if (!enabled) {
      // Switching off drops the flags: Rails derives its bounds from the
      // flags alone while the geometry additionally requires `enabled`,
      // so stale flags would make the editor stricter than the server.
      commit(setExtendedArea(definition, undefined));
      return;
    }
    commit(
      setExtendedArea(definition, {
        enabled: true,
        left: area.left ?? false,
        right: area.right ?? false,
        side_1: area.side_1 ?? false,
        side_2: area.side_2 ?? false,
      }),
    );
  };

  const handleFlag = (
    key: "left" | "right" | "side_1" | "side_2",
    on: boolean,
  ) => {
    commit(
      setExtendedArea(definition, {
        enabled: true,
        left: area.left ?? false,
        right: area.right ?? false,
        side_1: area.side_1 ?? false,
        side_2: area.side_2 ?? false,
        [key]: on,
      }),
    );
  };

  return (
    <fieldset className="drill-builder-group drill-court-setup">
      <legend>Court setup</legend>
      <div className="drill-court-setup-row">
        <div className="drill-court-setup-grid">
          <label>
            Columns
            <input
              type="number"
              min={1}
              step={1}
              defaultValue={columns}
              key={`columns-${columns}`}
              aria-label="Grid columns"
              onBlur={(event) => handleGrid("columns", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  handleGrid("columns", event.currentTarget.value);
              }}
            />
          </label>
          <label>
            Rows
            <input
              type="number"
              min={1}
              step={1}
              defaultValue={rows}
              key={`rows-${rows}`}
              aria-label="Grid rows"
              onBlur={(event) => handleGrid("rows", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  handleGrid("rows", event.currentTarget.value);
              }}
            />
          </label>
        </div>
        <label className="drill-court-setup-orientation">
          Default orientation
          <select
            aria-label="Default orientation"
            value={definition.view?.orientation ?? ""}
            onChange={(event) => {
              const value = event.target.value as Orientation | "";
              const next = setViewOrientation(
                definition,
                value === "" ? undefined : value,
              );
              if (next !== definition) onChange(next);
              // Clearing or setting the default never moves a placement.
              setReport(null);
            }}
          >
            <option value="">Viewer default</option>
            <option value="lateral">Lateral</option>
            <option value="top_down">Top down</option>
          </select>
        </label>
      </div>
      <label className="drill-court-setup-enabled">
        <input
          type="checkbox"
          checked={area.enabled}
          onChange={(event) => handleEnabled(event.target.checked)}
        />
        Extended area
      </label>
      <div className="drill-court-setup-flags" aria-label="Extended area sides">
        {EXTENSION_FLAGS.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={area.enabled && Boolean(area[key])}
              disabled={!area.enabled}
              onChange={(event) => handleFlag(key, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      {report && (
        <p className="drill-builder-note" role="status">
          {report}
        </p>
      )}
    </fieldset>
  );
}
