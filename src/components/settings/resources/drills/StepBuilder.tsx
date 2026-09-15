/**
 * StepBuilder — the visual editor for one step.
 *
 * One court plus everything that step owns: an entity palette (add placed
 * entities from the catalog, toggle active, remove from the step), an action
 * list and a movement list whose arrows draw on the court. Positions change by
 * dragging (solid = this step, ghost = next step); everything funnels through
 * the pure helpers in `drill-model.ts` so the invariant Rails enforces —
 * `movement.from` = this step, `movement.to` = the next step — always holds.
 */

import { useState } from "react";
import type { ActionType } from "../../../drill/definition";
import { ACTION_TYPES, DEFAULT_ORIENTATION } from "../../../drill/definition";
import InteractiveCourt from "./InteractiveCourt";
import type { Layer } from "./InteractiveCourt";
import {
  addActionToStep,
  addEntityToStep,
  entityList,
  removeActionFromStep,
  removeEntityFromStep,
  removeMovement,
  setEntityActive,
  setEntityLocation,
  setMovementDescription,
  type EntityKind,
} from "./drill-model";
import type {
  MovementEdit,
  SelectedEntity,
  StepBuilderProps,
} from "./stepBuilderModel";
import {
  ENTITY_KINDS,
  formatLocation,
  movementEntityId,
  movementListFor,
  placedIdsFor,
  statesFor,
} from "./stepBuilderModel";

export default function StepBuilder({
  definition,
  stepIndex,
  onChange,
}: StepBuilderProps) {
  const [orientation] = useState(DEFAULT_ORIENTATION);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);
  const [movementEdit, setMovementEdit] = useState<MovementEdit | null>(null);
  const [actionParticipant, setActionParticipant] = useState("");
  const [actionType, setActionType] = useState<ActionType>(ACTION_TYPES[0]);
  const [actionDescription, setActionDescription] = useState("");

  const step = definition.steps[stepIndex];
  if (!step) return null;
  const hasNext = stepIndex < definition.steps.length - 1;

  const handleMove = (
    kind: EntityKind,
    id: string,
    location: Parameters<typeof setEntityLocation>[4],
    layer: Layer,
  ) => {
    onChange(
      setEntityLocation(
        definition,
        layer === "current" ? stepIndex : stepIndex + 1,
        kind,
        id,
        location,
      ),
    );
  };

  const commitMovementEdit = () => {
    if (!movementEdit) return;
    const text = movementEdit.text.trim();
    onChange(
      setMovementDescription(
        definition,
        stepIndex,
        movementEdit.kind,
        movementEdit.index,
        text === "" ? undefined : text,
      ),
    );
    setMovementEdit(null);
  };

  const canAddAction =
    actionParticipant !== "" &&
    step.participants.some((state) => state.id === actionParticipant);

  const handleAddAction = () => {
    if (!canAddAction) return;
    const description = actionDescription.trim();
    onChange(
      addActionToStep(definition, stepIndex, {
        participant_id: actionParticipant,
        action: {
          type: actionType,
          ...(description === "" ? {} : { description }),
        },
      }),
    );
    setActionParticipant("");
    setActionDescription("");
  };
  return (
    <section className="drill-step-builder" aria-label={`Step ${step.id}`}>
      <div className="drill-builder-layout">
        <InteractiveCourt
          definition={definition}
          orientation={orientation}
          stepIndex={stepIndex}
          selected={selected}
          onSelect={(kind, id) => setSelected({ kind, id })}
          onMove={handleMove}
          onCourtClick={() => setSelected(null)}
        />

        <div className="drill-builder-side">
          {ENTITY_KINDS.map(({ kind, label }) => {
            const placed = placedIdsFor(step, kind);
            const catalog = entityList(definition, kind);
            const missing = catalog.filter((entity) => !placed.has(entity.id));
            return (
              <fieldset key={kind} className="drill-builder-group">
                <legend>{label}</legend>
                {statesFor(step, kind).length === 0 && (
                  <p className="drill-builder-empty">
                    Nothing placed on this step yet.
                  </p>
                )}
                <ul className="drill-builder-placed">
                  {statesFor(step, kind).map((state) => (
                    <li key={state.id}>
                      <button
                        type="button"
                        className={
                          selected?.kind === kind && selected.id === state.id
                            ? "drill-builder-chip selected"
                            : "drill-builder-chip"
                        }
                        onClick={() => setSelected({ kind, id: state.id })}
                        title={
                          state.location
                            ? formatLocation(state.location)
                            : "Not placed yet"
                        }
                      >
                        {state.id}
                        {!state.active && " (off)"}
                      </button>
                      <label className="drill-builder-active">
                        <input
                          type="checkbox"
                          checked={state.active}
                          onChange={(event) =>
                            onChange(
                              setEntityActive(
                                definition,
                                stepIndex,
                                kind,
                                state.id,
                                event.target.checked,
                              ),
                            )
                          }
                        />
                        active
                      </label>
                      <button
                        type="button"
                        className="admin-btn admin-btn-remove"
                        onClick={() =>
                          onChange(
                            removeEntityFromStep(
                              definition,
                              stepIndex,
                              kind,
                              state.id,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {missing.length > 0 && (
                  <div className="drill-builder-add">
                    <span className="drill-builder-add-label">Add:</span>
                    {missing.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        className="admin-btn admin-btn-add"
                        onClick={() =>
                          onChange(
                            addEntityToStep(definition, stepIndex, kind, entity.id),
                          )
                        }
                      >
                        Add {entity.id}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>

        <div className="drill-builder-column">
          <fieldset className="drill-builder-group">
            <legend>Movements from this step</legend>
            {hasNext ? (
              ENTITY_KINDS.map(({ kind, label }) => {
                const movements = movementListFor(step, kind);
                if (movements.length === 0) return null;
                return (
                  <div key={kind} className="drill-builder-movements-kind">
                    <h4>{label}</h4>
                    <ul className="drill-builder-movements">
                      {movements.map((movement, index) => {
                        const editing =
                          movementEdit?.kind === kind && movementEdit.index === index;
                        const entityLabel = movementEntityId(kind, movement);
                        return (
                          <li key={`${entityLabel}-${index}`}>
                            <span className="drill-builder-movement-label">
                              {entityLabel}:{" "}
                              {movement.from ? formatLocation(movement.from) : "start"} →{" "}
                              {formatLocation(movement.to)}
                            </span>
                            {editing ? (
                              <>
                                <input
                                  type="text"
                                  aria-label={`Movement note for ${entityLabel}`}
                                  value={movementEdit.text}
                                  onChange={(event) =>
                                    setMovementEdit({
                                      ...movementEdit,
                                      text: event.target.value,
                                    })
                                  }
                                  placeholder="e.g. P1 crosses"
                                />
                                <button type="button" onClick={commitMovementEdit}>
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMovementEdit(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="drill-builder-movement-description">
                                  {movement.description ?? "No description"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMovementEdit({
                                      kind,
                                      index,
                                      text: movement.description ?? "",
                                    })
                                  }
                                >
                                  {movement.description ? "Edit note" : "Add note"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChange(removeMovement(definition, stepIndex, kind, index))
                                  }
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </li>
                        );
                      })}

          <fieldset className="drill-builder-group">
            <legend>Actions in this step</legend>
            {step.actions.length === 0 && (
              <p className="drill-builder-empty">No actions yet.</p>
            )}
            <ul className="drill-builder-actions">
              {step.actions.map((entry, index) => (
                <li key={`${entry.participant_id}-${index}`}>
                  <span>
                    {entry.participant_id} — {entry.action.type}
                    {entry.action.description ? `: ${entry.action.description}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(removeActionFromStep(definition, stepIndex, index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="drill-builder-add-action">
              <label>
                Participant
                <select
                  value={actionParticipant}
                  onChange={(event) => setActionParticipant(event.target.value)}
                >
                  <option value="">Select…</option>
                  {step.participants.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Action
                <select
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as ActionType)}
                >
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <input
                  type="text"
                  value={actionDescription}
                  onChange={(event) => setActionDescription(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <button type="button" disabled={!canAddAction} onClick={handleAddAction}>
                Add action
              </button>
            </div>
          </fieldset>
                    </ul>
                  </div>
                );
              })
            ) : (
              <p className="drill-builder-empty">
                The last step has no next step, so its movements stay as authored.
              </p>
            )}
          </fieldset>
        </div>
      </div>
    </section>
  );
}