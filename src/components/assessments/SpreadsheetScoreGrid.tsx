import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AlertCircle, Check, Save } from "lucide-react";
import type {
  AssessmentScale,
  AssessmentSessionCategory,
  AssessmentSessionCategoryScore,
  AssessmentSessionParticipant,
  AssessmentSessionScoreInput,
} from "../../api";
import { legalValue, toScore, SCALE_LABELS, SCALE_MAXIMA } from "../../utils/rating";

interface SpreadsheetScoreGridProps {
  categories: AssessmentSessionCategory[];
  participants: AssessmentSessionParticipant[];
  isDraft: boolean;
  onSaveScores: (scores: AssessmentSessionScoreInput[]) => Promise<void>;
}

export default function SpreadsheetScoreGrid({
  categories,
  participants,
  isDraft,
  onSaveScores,
}: SpreadsheetScoreGridProps) {
  const includedParticipants = participants.filter((p) => p.inclusion === "included");
  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  const [gridValues, setGridValues] = useState<Record<number, Record<number, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedScale, setSelectedScale] = useState<AssessmentScale>("one_to_ten");

  const cellRefs = useRef<(HTMLInputElement | null)[][]>([]);

  /**
   * The saved entry for one cell, if the server has one. A saved row may be on
   * a different scale than the grid's selector (D10 allows 1-5 for one area and
   * 1-100 for another), so the cell keeps its own scale rather than being read
   * through the selector — otherwise a `4` out of 5 would render next to a
   * "out of 10" control and read as half marks.
   */
  const savedEntry = (
    playerProfileId: number,
    categoryId: number
  ): AssessmentSessionCategoryScore | undefined =>
    participants
      .find((p) => p.player_profile_id === playerProfileId)
      ?.result?.category_scores?.find((c) => c.assessment_category_id === categoryId);

  // Hydrate from the server payload, not just local state: a published session is
  // read-only, so without this its cells would stay permanently blank and the
  // weighted total would have no visible derivation. Local edits win while dirty.
  //
  // The sync is keyed on the payload identity and applied during render rather
  // than in an effect, so the grid does not cascade an extra render pass on load.
  const serverSignature = useMemo(
    () =>
      includedParticipants
        .map(
          (p) =>
            `${p.player_profile_id}:${(p.result?.category_scores ?? [])
              .map((c) => `${c.assessment_category_id}=${c.reported_value}`)
              .join(",")}`,
        )
        .join("|"),
    [includedParticipants],
  );

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  if (!dirty && hydratedFor !== serverSignature) {
    setHydratedFor(serverSignature);
    setGridValues((prev) => {
      const merged: Record<number, Record<number, string>> = {};
      for (const p of includedParticipants) {
        merged[p.player_profile_id] = {};
        for (const cat of sortedCategories) {
          const saved = savedEntry(p.player_profile_id, cat.id);
          merged[p.player_profile_id][cat.id] =
            saved?.reported_value != null
              ? String(saved.reported_value)
              : (prev[p.player_profile_id]?.[cat.id] ?? "");
        }
      }
      return merged;
    });
  }

  // A local edit takes over from the server payload until the next reload.
  if (dirty && hydratedFor === serverSignature) {
    setHydratedFor(null);
  }

  // Keep the ref matrix sized to the current grid. Assigning during render is
  // unsafe under concurrent rendering, so it is synced after commit instead.
  const rowCount = includedParticipants.length;
  const colCount = sortedCategories.length;

  useEffect(() => {
    cellRefs.current = Array.from({ length: rowCount }, (_, r) =>
      Array.from({ length: colCount }, (_, c) => cellRefs.current[r]?.[c] ?? null),
    );
  }, [rowCount, colCount]);

  const handleCellChange = (
    playerProfileId: number,
    categoryId: number,
    val: string
  ) => {
    setGridValues((prev) => ({
      ...prev,
      [playerProfileId]: {
        ...prev[playerProfileId],
        [categoryId]: val,
      },
    }));
    setDirty(true);
    setSaveSuccess(false);
    setError(null);
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      targetRow = Math.min(includedParticipants.length - 1, rowIndex + 1);
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault();
        targetCol = Math.max(0, colIndex - 1);
      } else {
        return;
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        targetCol = Math.min(sortedCategories.length - 1, colIndex + 1);
      } else {
        return;
      }
    } else {
      return;
    }

    cellRefs.current[targetRow]?.[targetCol]?.focus();
  };

  const computePreview = (playerProfileId: number) => {
    const playerCells = gridValues[playerProfileId] || {};
    let allValid = true;
    let anyFilled = false;
    let weightedSum = 0;

    for (const cat of sortedCategories) {
      const rawVal = playerCells[cat.id]?.trim();
      if (!rawVal) {
        allValid = false;
        continue;
      }
      anyFilled = true;
      const num = Number(rawVal);
      if (!legalValue(num, selectedScale)) {
        allValid = false;
        continue;
      }
      const score = toScore(num, selectedScale);
      weightedSum += score * cat.weight;
    }

    if (!anyFilled) return { status: "empty", score: null };
    if (allValid) {
      return { status: "complete", score: Math.round(weightedSum / 100) };
    }
    return { status: "incomplete", score: null };
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: AssessmentSessionScoreInput[] = [];

      for (const p of includedParticipants) {
        const playerCells = gridValues[p.player_profile_id] || {};
        const categoryScores = [];

        for (const cat of sortedCategories) {
          const rawVal = playerCells[cat.id]?.trim();
          if (rawVal === undefined || rawVal === "") {
            continue;
          }
          const num = Number(rawVal);
          if (!legalValue(num, selectedScale)) {
            throw new Error(
              `Invalid value "${rawVal}" for ${p.player_name} in ${cat.label}. Scale is ${selectedScale}.`
            );
          }
          categoryScores.push({
            assessment_category_id: cat.id,
            scale: selectedScale,
            value: num,
          });
        }

        if (categoryScores.length > 0) {
          payload.push({
            player_profile_id: p.player_profile_id,
            category_scores: categoryScores,
          });
        }
      }

      if (payload.length === 0) {
        throw new Error("No scores entered to save.");
      }

      await onSaveScores(payload);
      setDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scores.");
    } finally {
      setSaving(false);
    }
  };

  if (includedParticipants.length === 0) {
    return (
      <div className="session-grid-empty">
        <p>No included players on the roster to score. Add players above to open the score grid.</p>
      </div>
    );
  }

  return (
    <div className="session-score-grid-container">
      <div className="session-grid-toolbar">
        <div className="session-grid-scale-selector">
          <label htmlFor="grid-scale-select">Rating scale:</label>
          <select
            id="grid-scale-select"
            value={selectedScale}
            disabled={!isDraft || saving}
            onChange={(e) => setSelectedScale(e.target.value as AssessmentScale)}
          >
            <option value="one_to_ten">1 – 10 (Standard)</option>
            <option value="one_to_five">1 – 5</option>
            <option value="one_to_hundred">1 – 100</option>
          </select>
        </div>

        {isDraft && (
          <div className="session-grid-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add session-save-grid-btn"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
            >
              <Save size={14} />
              {saving ? "Saving..." : dirty ? "Save Scores Draft" : "Scores Saved"}
            </button>
            {saveSuccess && (
              <span className="session-save-success">
                <Check size={14} /> Saved
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="session-score-table-wrapper">
        <table className="session-score-table">
          <thead>
            <tr>
              <th className="col-player-name">Player</th>
              {sortedCategories.map((cat) => (
                <th key={cat.id} className="col-category">
                  <div className="category-header-title">{cat.label}</div>
                  <div className="category-header-weight">{cat.weight}%</div>
                </th>
              ))}
              <th className="col-preview-total">Live Total</th>
            </tr>
          </thead>
          <tbody>
            {includedParticipants.map((p, rIdx) => {
              const preview = computePreview(p.player_profile_id);
              const existingScore = p.result?.overall_score;

              return (
                <tr key={p.id} className="session-score-row">
                  <td className="cell-player-name">
                    <span className="player-name-text">{p.player_name}</span>
                  </td>
                  {sortedCategories.map((cat, cIdx) => {
                    const cellVal = gridValues[p.player_profile_id]?.[cat.id] ?? "";
                    const isCellInvalid =
                      cellVal.trim() !== "" && !legalValue(Number(cellVal), selectedScale);
                    // Show the scale the value was actually entered on when it
                    // differs from the grid's selector, so a published read-only
                    // session can't imply the wrong maximum (D10).
                    const cellScale: AssessmentScale = savedEntry(
                      p.player_profile_id,
                      cat.id,
                    )?.scale ?? selectedScale;
                    const scaleDiffers = cellScale !== selectedScale;

                    return (
                      <td key={cat.id} className="cell-score-input">
                        <div className="score-cell-wrap">
                          <input
                            ref={(el) => {
                              if (!cellRefs.current[rIdx]) cellRefs.current[rIdx] = [];
                              cellRefs.current[rIdx][cIdx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            className={`score-cell-input${isCellInvalid ? " invalid" : ""}`}
                            value={cellVal}
                            disabled={!isDraft || saving}
                            onChange={(e) =>
                              handleCellChange(p.player_profile_id, cat.id, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                            aria-label={`${p.player_name} ${cat.label}`}
                          />
                          {scaleDiffers && cellVal.trim() !== "" && (
                            <span
                              className="score-cell-scale"
                              title={`Entered on a ${SCALE_LABELS[cellScale]} scale`}
                            >
                              /{SCALE_MAXIMA[cellScale]}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="cell-preview-total">
                    {preview.score != null ? (
                      <span className="preview-score-badge complete" title="Calculated weighted total">
                        {preview.score}
                      </span>
                    ) : existingScore != null && !dirty ? (
                      <span className="preview-score-badge saved" title="Saved server total">
                        {existingScore}
                      </span>
                    ) : preview.status === "incomplete" ? (
                      <span className="preview-score-badge incomplete" title="Incomplete scores">
                        Incomplete
                      </span>
                    ) : (
                      <span className="preview-score-badge empty">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
