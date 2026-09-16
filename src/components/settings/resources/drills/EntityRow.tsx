/**
 * EntityRow — one participant / ball / object in the catalog.
 *
 * The row owns only its id draft: an id edit is committed on blur or Enter, and
 * the catalog cascades the rename into every step reference. The other fields
 * are written straight through. Removal is delegated upward so the catalog can
 * refuse while the entity is still used by a step.
 */

import { useState } from "react";
import type {
  Ball,
  DrillObject,
  Participant,
} from "../../../drill/definition";
import {
  BALL_TYPES,
  OBJECT_TYPES,
  PARTICIPANT_TYPES,
} from "../../../drill/definition";
import type { EntityKind } from "./drill-model";

export interface EntityRowProps {
  kind: EntityKind;
  entity: Participant | Ball | DrillObject;
  /** Ids of the sibling entities of the same kind, for uniqueness checks. */
  siblingIds: string[];
  /** Step ids that reference this entity. */
  usedInStepIds: string[];
  onEdit: (updated: Participant | Ball | DrillObject) => void;
  onRenameId: (newId: string) => void;
  onRemove: () => void;
}

export default function EntityRow({
  kind,
  entity,
  siblingIds,
  usedInStepIds,
  onEdit,
  onRenameId,
  onRemove,
}: EntityRowProps) {
  const [idDraft, setIdDraft] = useState(entity.id);
  const [idError, setIdError] = useState<string | null>(null);
  // The catalog keys each row by `entity.id`, so a committed rename remounts
  // this component and both pieces of state above start from the new id. That
  // is why no effect is needed to keep the draft in sync with the committed id.

  const typeOptions =
    kind === "participants"
      ? PARTICIPANT_TYPES
      : kind === "balls"
        ? BALL_TYPES
        : OBJECT_TYPES;

  const commitId = () => {
    const next = idDraft.trim();
    if (next === entity.id) {
      setIdDraft(entity.id);
      setIdError(null);
      return;
    }
    if (next === "") {
      setIdDraft(entity.id);
      setIdError("Id cannot be empty.");
      return;
    }
    if (siblingIds.some((id) => id.toLowerCase() === next.toLowerCase())) {
      setIdDraft(entity.id);
      setIdError(`"${next}" is already used.`);
      return;
    }
    setIdError(null);
    onRenameId(next);
  };

  return (
    <div className="drill-entity-row">
      <input
        type="text"
        className="drill-entity-id"
        aria-label={`Id of ${entity.id}`}
        value={idDraft}
        maxLength={64}
        onChange={(e) => setIdDraft(e.target.value)}
        onBlur={commitId}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitId();
          }
          if (e.key === "Escape") {
            setIdDraft(entity.id);
            setIdError(null);
          }
        }}
      />

      <select
        className="drill-entity-type"
        aria-label={`Type of ${entity.id}`}
        value={entity.type}
        // The options come from the schema enum, so the value is always a
        // member of the entity's type union.
        onChange={(e) =>
          onEdit({ ...entity, type: e.target.value } as
            | Participant
            | Ball
            | DrillObject)
        }
      >
        {typeOptions.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {kind === "participants" && (
        <input
          type="text"
          className="drill-entity-text"
          aria-label={`Role of ${entity.id}`}
          placeholder="role (optional)"
          value={(entity as Participant).role ?? ""}
          onChange={(e) =>
            onEdit({ ...(entity as Participant), role: e.target.value })
          }
        />
      )}

      <input
        type="text"
        className="drill-entity-text"
        aria-label={`Description of ${entity.id}`}
        placeholder="description (optional)"
        value={entity.description ?? ""}
        onChange={(e) => onEdit({ ...entity, description: e.target.value })}
      />

      {usedInStepIds.length > 0 && (
        <span
          className="drill-entity-badge"
          title={`Used in steps ${usedInStepIds.join(", ")}`}
        >
          in use
        </span>
      )}

      <button
        type="button"
        className="drill-builder-remove-btn"
        aria-label={`Remove ${entity.id}`}
        onClick={onRemove}
      >
        ×
      </button>

      {idError && (
        <span className="drill-entity-error" role="alert">
          {idError}
        </span>
      )}
    </div>
  );
}