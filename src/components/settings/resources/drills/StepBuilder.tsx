/**
 * StepBuilder — the per-step controls of the visual editor.
 *
 * Controls only: an entity palette (add placed entities from the catalog,
 * toggle active, remove from the step), an action list and a movement list.
 * The court itself lives in the surrounding `DrillDefinitionBuilder` sticky
 * pane, so selection is shared via `selected`/`onSelect` and every model edit
 * funnels through `onChange` — the pure helpers in `drill-model.ts` keep the
 * Rails invariant (`movement.from` = this step, `movement.to` = the next step)
 * true no matter how the user edits.
 */

import { useState } from "react";
import type { ActionType } from "../../../drill/definition";
import { ACTION_TYPES } from "../../../drill/definition";
import LocationFields from "./LocationFields";
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
  setMovementTarget,
  type EntityKind,
} from "./drill-model";
import type { MovementEdit, StepBuilderProps } from "./stepBuilderModel";
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
  hasNext,
  selected,
  onSelect,
  onChange,
}: StepBuilderProps) {
  const [movementEdit, setMovementEdit] = useState<MovementEdit | null>(null);
  const [actionParticipant, setActionParticipant] = useState("");
  const [actionType, setActionType] = useState<ActionType>(ACTION_TYPES[0]);
  const [actionDescription, setActionDescription] = useState("");

  const step = definition.steps[stepIndex];
  if (!step) return null;
  const nextStep = hasNext ? definition.steps[stepIndex + 1] : undefined;
  const nextStateFor = (kind: EntityKind, id: string) =>
    nextStep
      ? statesFor(nextStep, kind).find((candidate) => candidate.id === id)
      : undefined;

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
      <div className="drill-builder-side">
        {ENTITY_KINDS.map(({ kind, label }) => {
          const placed = placedIdsFor(step, kind);
          const catalog = entityList(definition, kind);
          const missing = catalog.filter((entity) => !placed.has(entity.id));
          return (
            <fieldset key={kind} className="drill-builder-group">
              <legend>{label}</legend>
              {statesFor(step, kind).length > 0 && (
                <p className="drill-builder-hint">
                  Add lands centre S1 — drag on the court, drag the ghost for
                  the next step, or type coordinates below.
                </p>
              )}
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
                      onClick={() => onSelect(kind, state.id)}
                      title={
                        state.location
                          ? formatLocation(state.location)
                          : "Not placed yet"
                      }
                      aria-label={`Select ${state.id}`}
                    >
                      {state.id}
                      {!state.active && " (off)"}
                    </button>
                    <label className="drill-builder-active">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${state.id} as active on this step`}
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
                    <LocationFields
                      location={state.location}
                      legend={`Location of ${state.id}`}
                      definition={definition}
                      onCommit={(location) =>
                        onChange(
                          setEntityLocation(
                            definition,
                            stepIndex,
                            kind,
                            state.id,
                            location,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-remove"
                      aria-label={`Remove ${state.id} from ${step.id}`}
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
                    {hasNext &&
                      state.active &&
                      state.location &&
                      nextStep &&
                      !nextStateFor(kind, state.id)?.active && (
                        <div className="drill-builder-no-arrow">
                          <span>
                            No arrow: {state.id} is{" "}
                            {nextStateFor(kind, state.id)
                              ? "inactive"
                              : "not placed"}{" "}
                            in {nextStep.id}.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (nextStateFor(kind, state.id)) {
                                // Activate in place: the location survives.
                                onChange(
                                  setEntityActive(
                                    definition,
                                    stepIndex + 1,
                                    kind,
                                    state.id,
                                    true,
                                  ),
                                );
                                return;
                              }
                              // Place it at this step's position, then the
                              // movement derives from the next drag (or edit).
                              onChange(
                                setEntityLocation(
                                  addEntityToStep(
                                    definition,
                                    stepIndex + 1,
                                    kind,
                                    state.id,
                                  ),
                                  stepIndex + 1,
                                  kind,
                                  state.id,
                                  state.location!,
                                ),
                              );
                            }}
                          >
                            Activate {state.id} in {nextStep.id}
                          </button>
                        </div>
                      )}
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
                          addEntityToStep(
                            definition,
                            stepIndex,
                            kind,
                            entity.id,
                          ),
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
          <p className="drill-builder-hint">
            Movements follow positions: from = this step, to = the next step.
            Drag a marker or its ghost, or type coordinates below.
          </p>
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
                        movementEdit?.kind === kind &&
                        movementEdit.index === index;
                      const entityLabel = movementEntityId(kind, movement);
                      return (
                        <li key={`${entityLabel}-${index}`}>
                          <span className="drill-builder-movement-label">
                            {entityLabel}:{" "}
                            {movement.from
                              ? formatLocation(movement.from)
                              : "start"}{" "}
                            → {formatLocation(movement.to)}
                          </span>
                          <LocationFields
                            location={movement.from}
                            legend={`Edit from of ${entityLabel}`}
                            definition={definition}
                            onCommit={(location) =>
                              onChange(
                                setEntityLocation(
                                  definition,
                                  stepIndex,
                                  kind,
                                  entityLabel,
                                  location,
                                ),
                              )
                            }
                          />
                          <LocationFields
                            location={movement.to}
                            legend={`Edit to of ${entityLabel} (next step)`}
                            definition={definition}
                            onCommit={(location) =>
                              onChange(
                                setEntityLocation(
                                  definition,
                                  stepIndex + 1,
                                  kind,
                                  entityLabel,
                                  location,
                                ),
                              )
                            }
                          />
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
                              <button
                                type="button"
                                onClick={commitMovementEdit}
                              >
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
                                className="admin-btn admin-btn-remove"
                                type="button"
                                onClick={() =>
                                  setMovementEdit({
                                    kind,
                                    index,
                                    text: movement.description ?? "",
                                  })
                                }
                              >
                                {movement.description
                                  ? "Edit note"
                                  : "Add note"}
                              </button>
                              <button
                                className="admin-btn admin-btn-remove"
                                type="button"
                                onClick={() =>
                                  onChange(
                                    removeMovement(
                                      definition,
                                      stepIndex,
                                      kind,
                                      index,
                                    ),
                                  )
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
                              {entry.action.description
                                ? `: ${entry.action.description}`
                                : ""}
                            </span>
                            <button
                              className="admin-btn admin-btn-remove"
                              type="button"
                              onClick={() =>
                                onChange(
                                  removeActionFromStep(
                                    definition,
                                    stepIndex,
                                    index,
                                  ),
                                )
                              }
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
                            onChange={(event) =>
                              setActionParticipant(event.target.value)
                            }
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
                            onChange={(event) =>
                              setActionType(event.target.value as ActionType)
                            }
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
                            onChange={(event) =>
                              setActionDescription(event.target.value)
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <button
                          className="admin-btn admin-btn-remove"
                          type="button"
                          disabled={!canAddAction}
                          onClick={handleAddAction}
                        >
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
              Edit the origin below, or the destination on the movement itself.
            </p>
          )}
          {!hasNext &&
            ENTITY_KINDS.map(({ kind, label }) => {
              const movements = movementListFor(step, kind);
              if (movements.length === 0) return null;
              return (
                <div key={kind} className="drill-builder-movements-kind">
                  <h4>{label}</h4>
                  <ul className="drill-builder-movements">
                    {movements.map((movement, index) => {
                      const entityLabel = movementEntityId(kind, movement);
                      return (
                        <li key={`${entityLabel}-${index}`}>
                          <span className="drill-builder-movement-label">
                            {entityLabel}:{" "}
                            {movement.from
                              ? formatLocation(movement.from)
                              : "start"}{" "}
                            → {formatLocation(movement.to)}
                          </span>
                          <LocationFields
                            location={movement.from}
                            legend={`Edit from of ${entityLabel}`}
                            definition={definition}
                            onCommit={(location) =>
                              onChange(
                                setEntityLocation(
                                  definition,
                                  stepIndex,
                                  kind,
                                  entityLabel,
                                  location,
                                ),
                              )
                            }
                          />
                          <LocationFields
                            location={movement.to}
                            legend={`Edit to of ${entityLabel} (authored)`}
                            locationType="exitTarget"
                            definition={definition}
                            onCommit={(location) =>
                              onChange(
                                setMovementTarget(
                                  definition,
                                  stepIndex,
                                  kind,
                                  index,
                                  location,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="drill-builder-remove-btn"
                            aria-label={`Remove movement of ${entityLabel}`}
                            onClick={() =>
                              onChange(
                                removeMovement(
                                  definition,
                                  stepIndex,
                                  kind,
                                  index,
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
        </fieldset>
      </div>
    </section>
  );
}
