import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Organisation } from "../api";

export interface OrganisationTreeNodeProps {
  organisation: Organisation;
  depth: number;
  childCount: number;
  collapsedIds: Set<number>;
  onToggle: (id: number) => void;
  searchTerm?: string;
  highlightedIds?: Set<number>;
  children?: OrganisationTreeNodeProps[];
}

export default function OrganisationTreeNode({
  organisation,
  depth,
  childCount,
  collapsedIds,
  onToggle,
  searchTerm = "",
  highlightedIds = new Set(),
  children = [],
}: OrganisationTreeNodeProps) {
  const isCollapsed = collapsedIds.has(organisation.id);
  const isHighlighted = highlightedIds.has(organisation.id);
  const hasChildren = childCount > 0 || children.length > 0;

  const indent = depth * 24; // 24px per level

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(organisation.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(organisation.id);
    }
  };

  return (
    <li
      className={`organisation-tree-node ${isHighlighted ? "highlighted" : ""} ${organisation.status === "archived" ? "archived" : ""}`}
      style={{ paddingLeft: `${indent}px` }}
      data-organisation-id={organisation.id}
    >
      <div className="organisation-tree-node__row">
        {hasChildren && (
          <button
            type="button"
            className="organisation-tree-node__expand"
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            aria-expanded={!isCollapsed}
            aria-controls={`org-children-${organisation.id}`}
            aria-label={isCollapsed ? `Expand ${organisation.name}` : `Collapse ${organisation.name}`}
          >
            <ChevronRight
              size={14}
              className={isCollapsed ? "collapsed" : "expanded"}
              aria-hidden="true"
            />
          </button>
        )}

        <div className="organisation-tree-node__content">
          {organisation.logo_attached && organisation.logo_url && (
            <img
              src={organisation.logo_url}
              alt=""
              className="organisation-tree-node__logo"
              width={24}
              height={24}
            />
          )}

          {!organisation.logo_attached && organisation.acronym && (
            <span className="organisation-tree-node__acronym" aria-hidden="true">
              {organisation.acronym}
            </span>
          )}

          <Link
            to={`/organisations/${organisation.id}`}
            className="organisation-tree-node__name"
            aria-current={isHighlighted ? "true" : undefined}
          >
            {organisation.name}
          </Link>

          <span className="organisation-tree-node__type">{organisation.organisation_type.replace(/_/g, " ")}</span>
          <span className={`organisation-tree-node__status ${organisation.status}`}>{organisation.status_label}</span>

          {hasChildren && (
            <span className="organisation-tree-node__child-count" aria-label={`${childCount} child organisation${childCount === 1 ? "" : "s"}`}>
              {childCount}
            </span>
          )}
        </div>
      </div>

      {!isCollapsed && hasChildren && children.length > 0 && (
        <ul
          id={`org-children-${organisation.id}`}
          className="organisation-tree-node__children"
          role="group"
          aria-label={`${organisation.name} children`}
        >
          {children.map((child) => (
            <OrganisationTreeNode
              key={child.organisation.id}
              {...child}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              searchTerm={searchTerm}
              highlightedIds={highlightedIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}