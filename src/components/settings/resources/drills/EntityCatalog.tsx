/**
 * EntityCatalog — the drill's roster: participants, balls and objects.
 *
 * These entities exist once per drill and the steps reference them by id, so the
 * catalog owns creation, editing, renaming (cascaded into every step reference)
 * and removal. Removing an entity a step still uses is refused with a warning
 * rather than silently orphaned.
 */

import { useState } from "react";
import type {
  Ball,
  DrillDefinition,
  DrillObject,
  Participant,
} from "../../../drill/definition";
import {
  DEFAULT_ENTITY_TYPE,
  entityList,
  nextEntityId,
  referencingStepIds,
  renameEntityId,
  type EntityKind,
} from "./drill-model";
import EntityRow from "./EntityRow";

const TABS: { kind: EntityKind; label: string; singular: string }[] = [
  { kind: "participants", label: "Participants", singular: "participant" },
  { kind: "balls", label: "Balls", singular: "ball" },
  { kind: "objects", label: "Objects", singular: "object" },
];

export interface EntityCatalogProps {
  definition: DrillDefinition;
  onChange: (next: DrillDefinition) => void;
}

export default function EntityCatalog({
  definition,
  onChange,
}: EntityCatalogProps) {
  const [kind, setKind] = useState<EntityKind>("participants");
  const [warning, setWarning] = useState<string | null>(null);

  const activeTab = TABS.find((tab) => tab.kind === kind)!;
  const entities = entityList(definition, kind);

  const changeTab = (next: EntityKind) => {
    setKind(next);
    setWarning(null);
  };

  /** A new entity starts valid: generated id + a default type from the enum. */
  const addEntity = () => {
    setWarning(null);
    const id = nextEntityId(definition, kind);
    switch (kind) {
      case "participants":
        onChange({
          ...definition,
          participants: [
            ...definition.participants,
            { id, type: DEFAULT_ENTITY_TYPE.participants },
          ],
        });
        return;
      case "balls":
        onChange({
          ...definition,
          balls: [
            ...definition.balls,
            { id, type: DEFAULT_ENTITY_TYPE.balls },
          ],
        });
        return;
      case "objects":
        onChange({
          ...definition,
          objects: [
            ...definition.objects,
            { id, type: DEFAULT_ENTITY_TYPE.objects },
          ],
        });
        return;
    }
  };

  const editEntity = (updated: Participant | Ball | DrillObject) => {
    setWarning(null);
    switch (kind) {
      case "participants":
        onChange({
          ...definition,
          participants: definition.participants.map((e) =>
            e.id === updated.id ? (updated as Participant) : e,
          ),
        });
        return;
      case "balls":
        onChange({
          ...definition,
          balls: definition.balls.map((e) =>
            e.id === updated.id ? (updated as Ball) : e,
          ),
        });
        return;
      case "objects":
        onChange({
          ...definition,
          objects: definition.objects.map((e) =>
            e.id === updated.id ? (updated as DrillObject) : e,
          ),
        });
        return;
    }
  };

  const renameEntity = (oldId: string, newId: string) => {
    setWarning(null);
    onChange(renameEntityId(definition, kind, oldId, newId));
  };

  const removeEntity = (id: string) => {
    const stepIds = referencingStepIds(definition, kind, id);
    if (stepIds.length > 0) {
      setWarning(
        `Cannot remove ${id}: still used in step${
          stepIds.length === 1 ? "" : "s"
        } ${stepIds.join(", ")}. Remove those references first.`,
      );
      return;
    }
    setWarning(null);
    switch (kind) {
      case "participants":
        onChange({
          ...definition,
          participants: definition.participants.filter((e) => e.id !== id),
        });
        return;
      case "balls":
        onChange({
          ...definition,
          balls: definition.balls.filter((e) => e.id !== id),
        });
        return;
      case "objects":
        onChange({
          ...definition,
          objects: definition.objects.filter((e) => e.id !== id),
        });
        return;
    }
  };

  return (
    <div className="drill-entity-catalog">
      <div className="drill-entity-tabs" role="tablist" aria-label="Entity kind">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={tab.kind === kind}
            className="drill-entity-tab"
            onClick={() => changeTab(tab.kind)}
          >
            {tab.label}
            <span className="drill-entity-count">
              {entityList(definition, tab.kind).length}
            </span>
          </button>
        ))}
      </div>

      {warning && (
        <p className="drill-entity-warning" role="alert">
          {warning}
        </p>
      )}

      {entities.length === 0 ? (
        <p className="drill-entity-empty">
          No {activeTab.label.toLowerCase()} yet — add the first one below.
        </p>
      ) : (
        <div className="drill-entity-list">
          {entities.map((entity) => (
            <EntityRow
              key={entity.id}
              kind={kind}
              entity={entity}
              siblingIds={entities
                .filter((e) => e.id !== entity.id)
                .map((e) => e.id)}
              usedInStepIds={referencingStepIds(definition, kind, entity.id)}
              onEdit={editEntity}
              onRenameId={(newId) => renameEntity(entity.id, newId)}
              onRemove={() => removeEntity(entity.id)}
            />
          ))}
        </div>
      )}

      <div className="drill-entity-actions">
        <button
          type="button"
          className="drill-builder-add-btn"
          aria-label={`Add ${activeTab.singular}`}
          onClick={addEntity}
        >
          +
        </button>
      </div>
    </div>
  );
}