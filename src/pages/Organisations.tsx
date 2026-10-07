import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
} from "lucide-react";
import {
  api,
  type Organisation,
  type OrganisationType,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import OrganisationTreeNode, { type OrganisationTreeNodeProps } from "../components/OrganisationTreeNode";

const ORGANISATION_TYPES: Array<{ value: OrganisationType; label: string }> = [
  { value: "international_federation", label: "International federation" },
  { value: "national_federation", label: "National federation" },
  { value: "state_federation", label: "State / regional federation" },
  { value: "club", label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "school", label: "School" },
  { value: "association", label: "Association" },
  { value: "other", label: "Other" },
];

// Mirrors the server's limits so an obviously wrong file is refused before it is
// sent. The server stays the authority: this is a courtesy, not a check.
const LOGO_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";

/**
 * Organisations are the hierarchical context a club or federation sits in — one
 * self-referencing tree rather than a table per level, so the depth is unbounded
 * and nothing here assumes a fixed number of tiers.
 *
 * Reading is open to any training manager, matching the server. What a given user
 * may *do* is per organisation rather than per role — a curator can edit all of
 * them, a club's owner only their own — so the controls are driven by the
 * `can_edit` and `can_delete` flags the API returns with each row. The role check
 * that remains is for *creating* one, which is a site-level act and genuinely is
 * admin-only.
 *
 * The logo is optional and goes up on its own multipart route, so this screen
 * never has to reason about two content types at once.
 */
export default function Organisations() {
  const { user } = useAuth();
  // Creating a node asserts its place in the federation tree to every other club,
  // so this one really is admin-only. Everything else is per record.
  const isAdmin =
    !!user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNew, setShowNew] = useState(false);
  // Which nodes are folded. A set of ids rather than a map: folding is a property
  // of the node, and every node starts unfolded, so an absent id means "open".
  // Persist in localStorage keyed by view state (showArchived + searchTerm).
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("organisations-collapsed");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("organisations-collapsed", JSON.stringify(Array.from(collapsed)));
    } catch {
      // Ignore storage errors
    }
  }, [collapsed]);

  const load = useCallback(() => {
    // Every setState here is inside a promise callback, never synchronously in the
    // effect body — a synchronous one cascades an extra render on every load. Same
    // shape as Groups.
    // showArchived: false = active only; true = all (active + archived)
    return api
      // `tree`: the whole hierarchy in one response. This page only ever draws a
      // tree, so a page boundary here would strand children under parents that are
      // not in the response.
      .organisations(showArchived ? undefined : "active", undefined, true)
      .then((page) => {
        setOrganisations(page.data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Failed to load organisations.",
        ),
      );
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (saved: Organisation) => {
    setOrganisations((current) => [
      saved,
      ...current.filter((o) => o.id !== saved.id),
    ]);
  };
  //
  // Built from the flat list rather than fetched recursively: each row carries its
  // parent, so the whole hierarchy arrives in one request and no endpoint has to
  // return a nested structure by default.
  const toggleCollapsed = (id: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const highlightedIds = useMemo(() => {
    if (!searchTerm.trim()) return new Set<number>();

    const term = searchTerm.toLowerCase().trim();
    const matchingIds = new Set<number>();

    // Find all organisations matching the search term
    organisations.forEach((org) => {
      if (org.name.toLowerCase().includes(term) ||
          org.acronym?.toLowerCase().includes(term) ||
          org.organisation_type.toLowerCase().includes(term)) {
        matchingIds.add(org.id);
      }
    });

    // Add ancestor IDs for each matching organisation
    const byId = new Map(organisations.map((org) => [org.id, org]));
    matchingIds.forEach((id) => {
      let current = byId.get(id);
      while (current?.parent_organisation_id) {
        matchingIds.add(current.parent_organisation_id);
        current = byId.get(current.parent_organisation_id);
      }
    });

    return matchingIds;
  }, [organisations, searchTerm]);
  const tree = useMemo(() => {
    const byParent = new Map<number | null, Organisation[]>();
    organisations.forEach((organisation) => {
      const siblings = byParent.get(organisation.parent_organisation_id) ?? [];
      siblings.push(organisation);
      byParent.set(organisation.parent_organisation_id, siblings);
    });

    // Build nested tree structure for OrganisationTreeNode
    const buildTreeNode = (organisation: Organisation, depth: number): OrganisationTreeNodeProps => {
      const children = byParent.get(organisation.id) ?? [];
      return {
        organisation,
        depth,
        childCount: children.length,
        collapsedIds: collapsed,
        onToggle: toggleCollapsed,
        searchTerm,
        highlightedIds: highlightedIds,
        children: children.map((child) => buildTreeNode(child, depth + 1)),
      };
    };

    const roots = byParent.get(null) ?? [];
    const treeNodes = roots.map((root) => buildTreeNode(root, 0));

    // Handle detached nodes (parent not in response due to filter)
    const present = new Set(organisations.map((organisation) => organisation.id));
    const detached = organisations.filter(
      (organisation) =>
        organisation.parent_organisation_id !== null &&
        !present.has(organisation.parent_organisation_id),
    );

    // Add detached nodes as top-level with depth 0
    detached.forEach((org) => {
      treeNodes.push(buildTreeNode(org, 0));
    });

    return treeNodes;
  }, [organisations, collapsed, searchTerm, highlightedIds]);

  // Compute highlighted IDs for search (matching organisations + their ancestors)

  // Expand All / Collapse All for currently visible (filtered) organisations
  const expandAll = useCallback(() => {
    if (!searchTerm.trim()) {
      setCollapsed(new Set());
    } else {
      // When searching, expand all highlighted (matching + ancestors)
      setCollapsed((current) => {
        const next = new Set(current);
        highlightedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [searchTerm, highlightedIds]);

  const collapseAll = useCallback(() => {
    if (!searchTerm.trim()) {
      // Collapse all organisations that have children
      const allWithChildren = new Set(
        organisations.filter((org) => org.child_count > 0).map((org) => org.id)
      );
      setCollapsed(allWithChildren);
    } else {
      // When searching, collapse all highlighted
      setCollapsed((current) => {
        const next = new Set(current);
        highlightedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [searchTerm, organisations, highlightedIds]);

  return (
    <div className="page organisations-page">
      <PageHeader title="Organisations">
        <p className="page-header-description">
          The federation, state and club structure this project sits in.
        </p>
        <div className="organisations-toolbar">
          <label className="organisations-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search organisations…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search organisations"
            />
          </label>
          <label className="organisations-archived-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
          {tree.length > 0 && (
            <div className="organisations-expand-controls">
              <button
                type="button"
                className="admin-btn"
                onClick={expandAll}
                aria-label="Expand all"
              >
                <ChevronDown size={14} /> Expand all
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={collapseAll}
                aria-label="Collapse all"
              >
                <ChevronRight size={14} /> Collapse all
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}

      {showNew && isAdmin && (
        <NewOrganisationForm
          organisations={organisations}
          onCancel={() => setShowNew(false)}
          onCreated={(created, logoError) => {
            replace(created);
            setShowNew(false);
            if (logoError) {
              // The organisation exists; only the crest failed. Saying so is
              // better than a bare failure, which would read as "nothing happened".
              setNotice(null);
              setError(
                `${created.name} was created, but the logo was not uploaded: ${logoError}`,
              );
            } else {
              setNotice(`${created.name} created.`);
            }
          }}
        />
      )}
      {isAdmin && !showNew && (
        <div className="admin-form-actions session-actions">
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => setShowNew(true)}
          >
            <Plus size={14} />
            New organisation
          </button>
        </div>
      )}
      {tree.length === 0 ? (
        <EmptyState
          title="No organisations yet"
          description="An organisation is a club, academy or federation. Create the top of the tree first, then add what sits under it."
        />
      ) : (
        <ul className="organisations-tree" role="tree">
          {tree.map((node) => (
            <OrganisationTreeNode key={node.organisation.id} {...node} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The organisations that may be given as `id`'s parent: everything except `id`
 * itself and its descendants.
 *
 * Each of those is a cycle — A under B while B sits under A — which the server
 * rejects. Excluding them here means the selector never offers a choice that
 * cannot be saved, rather than offering it and reporting the refusal afterwards.
 * Walked from the flat list, which the tree view has already loaded.
 */
function parentCandidates(
  organisations: Organisation[],
  id: number,
): Organisation[] {
  const childrenOf = new Map<number, number[]>();
  organisations.forEach((candidate) => {
    if (candidate.parent_organisation_id === null) return;
    const siblings = childrenOf.get(candidate.parent_organisation_id) ?? [];
    siblings.push(candidate.id);
    childrenOf.set(candidate.parent_organisation_id, siblings);
  });

  const forbidden = new Set<number>([id]);
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as number;
    (childrenOf.get(current) ?? []).forEach((childId) => {
      if (forbidden.has(childId)) return;
      forbidden.add(childId);
      stack.push(childId);
    });
  }

  return organisations.filter((candidate) => !forbidden.has(candidate.id));
}

/**
 * Create a brand-new organisation. Only an admin may do this, because a new node
 * asserts its place in the federation tree to every other club.
 */
function NewOrganisationForm({
  organisations,
  onCancel,
  onCreated,
}: {
  organisations: Organisation[];
  onCancel: () => void;
  onCreated: (created: Organisation, logoError: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganisationType>("club");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api.createOrganisation({
        name,
        organisation_type: type,
        description: description || null,
        parent_organisation_id: parentId,
      });
      let logoError: string | null = null;
      if (logo) {
        try {
          await api.uploadOrganisationLogo(created.id, logo);
        } catch (err) {
          logoError = err instanceof Error ? err.message : "Logo upload failed.";
        }
      }
      onCreated(created, logoError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organisation.");
    } finally {
      setBusy(false);
    }
  };

  const candidates = useMemo(
    () => parentCandidates(organisations, -1),
    [organisations],
  );

  return (
    <form className="organisations-new-form" onSubmit={handleSubmit}>
      <h3>New organisation</h3>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-row">
        <label htmlFor="new-name">Name</label>
        <input
          id="new-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={busy}
          autoFocus
        />
      </div>
      <div className="form-row">
        <label htmlFor="new-type">Type</label>
        <select
          id="new-type"
          value={type}
          onChange={(event) => setType(event.target.value as OrganisationType)}
          disabled={busy}
        >
          {ORGANISATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="new-description">Description</label>
        <textarea
          id="new-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          disabled={busy}
        />
      </div>
      <div className="form-row">
        <label htmlFor="new-parent">Parent organisation</label>
        <select
          id="new-parent"
          value={parentId ?? ""}
          onChange={(event) =>
            setParentId(event.target.value ? Number(event.target.value) : null)
          }
          disabled={busy}
        >
          <option value="">— No parent (top level) —</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="new-logo">Logo (optional)</label>
        <input
          id="new-logo"
          type="file"
          accept={LOGO_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setLogo(file);
          }}
          disabled={busy}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}


