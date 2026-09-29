import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  ChevronRight,
  ImageUp,
  Layers,
  Plus,
  UsersRound,
  X,
} from "lucide-react";
import {
  api,
  type Organisation,
  type OrganisationInput,
  type OrganisationMembership,
  type OrganisationMembershipRole,
  type OrganisationType,
  type PersonIdentity,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

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
const MAX_LOGO_BYTES = 10 * 1024 * 1024;
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
  const [showNew, setShowNew] = useState(false);
  // Which row is open for editing, if any. A single id rather than a map: two open
  // forms side by side in a list this flat is noise, not power.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Which roster is open. Separate from `editingId` on purpose: a roster is read by
  // anyone who can see the organisation, while editing is per-row permission.
  const [rosterId, setRosterId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  // Which nodes are folded. A set of ids rather than a map: folding is a property
  // of the node, and every node starts unfolded, so an absent id means "open".
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const load = useCallback(() => {
    // Every setState here is inside a promise callback, never synchronously in the
    // effect body — a synchronous one cascades an extra render on every load. Same
    // shape as Groups.
    return api
      // `tree`: the whole hierarchy in one response. This page only ever draws a
      // tree, so a page boundary here would strand children under parents that are
      // not in the response.
      .organisations(showArchived ? "archived" : "active", undefined, true)
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

  const run = async (
    id: number,
    fn: () => Promise<Organisation>,
    message: string,
  ) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      replace(await fn());
      setNotice(message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The action could not be completed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  // --- hard delete ----------------------------------------------------------
  //
  // Deliberately separate from `run`: this one is irreversible and returns no
  // record, so the row is removed from local state rather than replaced. The server
  // refuses it for anything with children or members, and `can_delete` is what it
  // said in advance — but a 409 here is still handled, because the state can change
  // between the list being fetched and the button being pressed.
  const destroy = async (organisation: Organisation) => {
    setBusyId(organisation.id);
    setError(null);
    setNotice(null);
    try {
      await api.deleteOrganisation(organisation.id);
      setOrganisations((current) =>
        current.filter((o) => o.id !== organisation.id),
      );
      setNotice(`${organisation.name} deleted.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The organisation could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  };

  // --- logo upload ---------------------------------------------------------
  const uploadLogo = async (organisation: Organisation, file: File) => {
    if (!LOGO_ACCEPT.split(",").includes(file.type)) {
      setError("A logo must be a PNG, JPEG, GIF, WEBP or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("A logo must be smaller than 10 MB.");
      return;
    }

    setUploadingId(organisation.id);
    setError(null);
    setNotice(null);
    try {
      replace(await api.uploadOrganisationLogo(organisation.id, file));
      setNotice(`Logo updated for ${organisation.name}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The logo could not be uploaded.",
      );
    } finally {
      setUploadingId(null);
    }
  };

  // --- tree ----------------------------------------------------------------
  //
  // Built from the flat list rather than fetched recursively: each row carries its
  // parent, so the whole hierarchy arrives in one request and no endpoint has to
  // return a nested structure by default.
  const tree = useMemo(() => {
    const byParent = new Map<number | null, Organisation[]>();
    organisations.forEach((organisation) => {
      const siblings = byParent.get(organisation.parent_organisation_id) ?? [];
      siblings.push(organisation);
      byParent.set(organisation.parent_organisation_id, siblings);
    });

    const rows: Array<{
      organisation: Organisation;
      depth: number;
      childCount: number;
    }> = [];
    const emitted = new Set<number>();
    const place = (organisation: Organisation, depth: number) => {
      // Idempotent: the detached pass below walks organisations that a parent may
      // already have emitted, and a second visit would duplicate the whole subtree.
      if (emitted.has(organisation.id)) return;
      emitted.add(organisation.id);
      const children = byParent.get(organisation.id) ?? [];
      rows.push({ organisation, depth, childCount: children.length });
      // Folding hides the subtree but not the node itself, so the control stays
      // reachable to unfold it again.
      if (collapsed.has(organisation.id)) return;
      children.forEach((child) => place(child, depth + 1));
    };

    (byParent.get(null) ?? []).forEach((root) => place(root, 0));

    // A node is detached only when its parent id names something this response does
    // not contain — an archived parent hidden by the status filter, say. Those are
    // shown at the top level rather than dropped, because walking from the roots
    // alone would make them vanish: a filter that hides rows rather than narrowing
    // them. Everything else is placed by its own parent, so it is left alone here.
    // Deliberately not "not yet emitted": folding hides a subtree, and a folded
    // child is still attached.
    const present = new Set(organisations.map((organisation) => organisation.id));
    organisations
      .filter(
        (organisation) =>
          organisation.parent_organisation_id !== null &&
          !present.has(organisation.parent_organisation_id),
      )
      .forEach((organisation) => place(organisation, 0));

    return rows;
  }, [organisations, collapsed]);

  const toggleCollapsed = (id: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="page organisations-page">
      <PageHeader title="Organisations">
        <p className="page-header-description">
          The federation, state and club structure this project sits in.
        </p>
        <label className="organisations-archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
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
        <ul className="organisations-tree">
          {tree.map(({ organisation, depth, childCount }) => {
            const isCollapsed = collapsed.has(organisation.id);
            return (
            <li
              key={organisation.id}
              className="organisations-row"
              style={{ paddingLeft: `${depth * 1.5}rem` }}
            >
              {/* Only nodes that actually have children get a fold control, so a
                  leaf is not offered an action that would do nothing. The spacer
                  keeps leaves aligned with the branches above them. */}
              {childCount > 0 ? (
                <button
                  type="button"
                  className="organisations-fold"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${organisation.name}`}
                  onClick={() => toggleCollapsed(organisation.id)}
                >
                  <ChevronRight
                    size={14}
                    style={{ transform: isCollapsed ? "none" : "rotate(90deg)" }}
                  />
                </button>
              ) : (
                <span className="organisations-fold-spacer" aria-hidden="true" />
              )}

              <span className="organisations-row-marker" aria-hidden="true">
                {depth === 0 ? "" : "└"}
              </span>

              {/* The uploaded logo when there is one, and the organisation's
                  initials when there is not — a row without a logo should look
                  deliberate rather than broken. */}
              {organisation.logo_url ? (
                <img
                  src={organisation.logo_url}
                  alt={`${organisation.name} logo`}
                  className="organisations-logo"
                />
              ) : (
                <span
                  className="organisations-logo organisations-logo-fallback"
                  title={organisation.acronym ?? organisation.name}
                  aria-hidden="true"
                >
                  {/* The acronym when there is one: slicing the name gives "FÉ" for
                      Fédération Internationale de Volleyball, which is worse than no
                      badge at all. */}
                  {organisation.acronym ??
                    organisation.name.slice(0, 2).toUpperCase()}
                </span>
              )}

              <div className="organisations-row-body">
                <span className="organisations-row-name">
                  {organisation.name}
                </span>
                <span className="organisations-row-meta">
                  {organisation.organisation_type.replace(/_/g, " ")}
                  {" · "}
                  {childCount} child
                  {childCount === 1 ? "" : "ren"}
                  {/* Named rather than left to the indentation: a parent is otherwise
                      only inferable from position, which is exactly the thing that
                      cannot be checked when a node looks misfiled. */}
                  {organisation.parent_organisation && (
                    <>
                      {" · under "}
                      {organisation.parent_organisation.name}
                    </>
                  )}
                </span>
              </div>

              {organisation.can_edit && (
                <div className="organisations-row-actions">
                  <label className="organisations-logo-upload">
                    <ImageUp size={14} />
                    <span>
                      {uploadingId === organisation.id
                        ? "Uploading..."
                        : organisation.logo_attached
                          ? "Replace logo"
                          : "Add logo"}
                    </span>
                    <input
                      type="file"
                      accept={LOGO_ACCEPT}
                      aria-label={`Upload logo for ${organisation.name}`}
                      disabled={uploadingId !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(organisation, file);
                        // Cleared so re-picking the same file fires a change again.
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {organisation.status === "archived" ? (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyId === organisation.id}
                      onClick={() =>
                        void run(
                          organisation.id,
                          () => api.restoreOrganisation(organisation.id),
                          `${organisation.name} restored.`,
                        )
                      }
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyId === organisation.id}
                      onClick={() =>
                        void run(
                          organisation.id,
                          () => api.archiveOrganisation(organisation.id),
                          `${organisation.name} archived. Its place in the tree is kept.`,
                        )
                      }
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busyId === organisation.id}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setEditingId(
                        editingId === organisation.id ? null : organisation.id,
                      );
                    }}
                  >
                    {editingId === organisation.id ? "Cancel edit" : "Edit"}
                  </button>
                  {organisation.can_delete && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      disabled={busyId === organisation.id}
                      onClick={() => {
                        // `confirm` rather than an inline toggle: the action cannot
                        // be undone and there is no draft to discard first.
                        if (
                          window.confirm(
                            `Delete ${organisation.name} permanently? This cannot be undone.`,
                          )
                        ) {
                          void destroy(organisation);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}

              {/* The roster is *readable* by anyone who can see the organisation —
                  the server narrows what each viewer sees — so this control is
                  outside the `can_edit` block. Putting it inside would hide the
                  roster from exactly the people who are meant to consult it. */}
              <div className="organisations-row-actions">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busyId === organisation.id}
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setRosterId(
                      rosterId === organisation.id ? null : organisation.id,
                    );
                  }}
                >
                  <UsersRound size={14} />
                  {rosterId === organisation.id ? "Close roster" : "Members"}
                </button>
              </div>

              {/* The form sits inside the row rather than in a panel at the top, so
                  the thing being edited stays in the place it lives in the tree. */}
              {editingId === organisation.id && (
                <EditOrganisationForm
                  organisation={organisation}
                  organisations={organisations}
                  canSetParent={isAdmin}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    replace(saved);
                    setEditingId(null);
                    setNotice(`${saved.name} updated.`);
                  }}
                />
              )}

              {/* The roster opens inside the row for the same reason the edit form
                  does. `canEdit` is the right permission here: the same officers
                  who may correct the record are the ones who run the roster. */}
              {rosterId === organisation.id && (
                <OrganisationRoster
                  organisation={organisation}
                  canManage={organisation.can_manage_members}
                  onClose={() => setRosterId(null)}
                />
              )}
            </li>
            );
          })}
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
 * Edit an existing organisation's own record: its name, type and description, and —
 * for an admin — the parent it sits under.
 *
 * The parent selector is admin-only because moving a node in the federation tree
 * asserts its place to every other club, and the server drops the field for anyone
 * else. Offering it to a non-admin would render a control whose value the submit
 * discards, which reads as a broken form rather than a permission boundary.
 */
function EditOrganisationForm({
  organisation,
  organisations,
  canSetParent,
  onCancel,
  onSaved,
}: {
  organisation: Organisation;
  organisations: Organisation[];
  canSetParent: boolean;
  onCancel: () => void;
  onSaved: (saved: Organisation) => void;
}) {
  const [name, setName] = useState(organisation.name);
  const [acronym, setAcronym] = useState(organisation.acronym ?? "");
  const [type, setType] = useState<OrganisationType>(
    organisation.organisation_type,
  );
  const [parentId, setParentId] = useState<number | "">(
    organisation.parent_organisation_id ?? "",
  );
  const [description, setDescription] = useState(
    organisation.description ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The node itself and everything beneath it are not offered as a parent: the
  // server rejects a cycle with a clear message, but a choice that cannot be saved
  // is better not offered.
  const parentOptions = parentCandidates(organisations, organisation.id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the organisation a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await api.updateOrganisation(organisation.id, {
          name: name.trim(),
          // An emptied field clears the acronym rather than leaving a stale one:
          // a club that stops using a short form should not keep displaying it.
          acronym: acronym.trim() || null,
          description: description.trim() || null,
          organisation_type: type,
          // Sent only for an admin, and sent always rather than only on change: a
          // parent cleared here has to reach the server as `null` to be detached.
          // A non-admin never sends the key, so the field cannot be smuggled in
          // past a control they were not shown.
          ...(canSetParent
            ? { parent_organisation_id: parentId === "" ? null : parentId }
            : {}),
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The organisation could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="organisations-form" onSubmit={submit}>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      <label className="admin-field">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <label className="admin-field">
        Acronym
        <input
          value={acronym}
          placeholder="e.g. FIVB"
          onChange={(event) => setAcronym(event.target.value)}
        />
      </label>

      <label className="admin-field">
        Type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as OrganisationType)}
        >
          {ORGANISATION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {canSetParent && (
        <label className="admin-field">
          Parent organisation
          <select
            value={parentId}
            onChange={(event) =>
              setParentId(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          >
            <option value="">None — this is a top-level organisation</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="admin-field">
        Description
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="admin-form-actions">
        <button
          type="submit"
          className="admin-btn admin-btn-add"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          <X size={14} />
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The roster of one organisation: who belongs, who has left, and who is recorded
 * but not yet active.
 *
 * Membership is not editable by anyone who can *see* the organisation — the server
 * delegates the roster to the club's own officers. So `canManage` is passed in
 * rather than re-derived from the user's role, for the same reason the rows do.
 */
function OrganisationRoster({
  organisation,
  canManage,
  onClose,
}: {
  organisation: Organisation;
  canManage: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<OrganisationMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPerson, setBusyPerson] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Fetched in the effect with the assignment inside the promise callback rather
  // than through a helper: calling setState synchronously in an effect body
  // triggers a cascading render, which the lint rule catches and rightly so.
  useEffect(() => {
    let cancelled = false;
    api
      .organisationMembers(organisation.id)
      .then((result) => {
        if (!cancelled) setMembers(result.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "The roster could not be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organisation.id]);

  const changeRole = async (member: OrganisationMembership, role: string) => {
    setBusyPerson(member.person_id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateOrganisationMember(
        organisation.id,
        member.person_id,
        {
          role: role as OrganisationMembershipRole,
        },
      );
      setMembers((current) =>
        (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(`${updated.person_name} is now ${updated.role_label}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The role could not be changed.",
      );
    } finally {
      setBusyPerson(null);
    }
  };

  // One call either way, because the server decides: a real member's row survives
  // as `ended`, while somebody recorded but never activated is removed outright —
  // there is no stint to preserve in that case.
  const endOrWithdraw = async (member: OrganisationMembership) => {
    const verb =
      member.status === "pending"
        ? "Remove the not-yet-active record for"
        : "End the membership of";
    if (!window.confirm(`${verb} ${member.person_name}?`)) return;

    setBusyPerson(member.person_id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.endOrganisationMember(
        organisation.id,
        member.person_id,
      );
      setMembers((current) =>
        result.removed
          ? (current ?? []).filter((row) => row.person_id !== member.person_id)
          : (current ?? []).map((row) =>
              row.person_id === member.person_id && result.membership
                ? result.membership
                : row,
            ),
      );
      setNotice(
        result.message ?? `${member.person_name} removed from the roster.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That could not be changed.",
      );
    } finally {
      setBusyPerson(null);
    }
  };

  const all = members ?? [];
  // Nobody produces this any more: adding somebody is immediate. It survives as an
  // explicit choice meaning "recorded, but not yet active" — somebody an officer put
  // on the roster ahead of time, before they actually start.
  const notActive = all.filter((m) => m.status === "pending");
  const active = all.filter(
    (m) => m.status === "active" || m.status === "suspended",
  );
  const former = all.filter((m) => m.status === "ended");

  return (
    <div className="organisations-roster">
      <div className="organisations-roster-head">
        <h3>
          <UsersRound size={15} /> {organisation.name} — roster
        </h3>
        <button type="button" className="admin-btn" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>

      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}

      {members === null && !error && (
        <p className="organisations-roster-empty">Loading…</p>
      )}

      {canManage && (
        <div className="organisations-roster-add">
          {adding ? (
            <AddMemberForm
              organisationId={organisation.id}
              existingPersonIds={all.map((m) => m.person_id)}
              onCancel={() => setAdding(false)}
              onAdded={(membership) => {
                setMembers([...all, membership]);
                setAdding(false);
                setNotice(`${membership.person_name} added to the roster.`);
              }}
            />
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => setAdding(true)}
            >
              <Plus size={14} /> Add someone
            </button>
          )}
        </div>
      )}

      {members !== null && all.length === 0 && (
        <p className="organisations-roster-empty">
          Nobody is recorded here yet.
        </p>
      )}

      <RosterGroup
        title={`Not yet active (${notActive.length})`}
        rows={notActive}
        canManage={canManage}
        busyPerson={busyPerson}
        onRole={changeRole}
        onEnd={endOrWithdraw}
        emptyText="Nobody is recorded but not yet active."
      />
      <RosterGroup
        title={`Members (${active.length})`}
        rows={active}
        canManage={canManage}
        busyPerson={busyPerson}
        onRole={changeRole}
        onEnd={endOrWithdraw}
        emptyText="Nobody is an active member."
      />
      <RosterGroup
        title={`Former members (${former.length})`}
        rows={former}
        canManage={canManage}
        busyPerson={busyPerson}
        onRole={changeRole}
        onEnd={endOrWithdraw}
        emptyText="Nobody has left yet."
      />
    </div>
  );
}

const MEMBERSHIP_ROLES: { value: OrganisationMembershipRole; label: string }[] =
  [
    { value: "member", label: "Member" },
    { value: "coach", label: "Coach" },
    { value: "administrator", label: "Administrator" },
    { value: "owner", label: "Owner" },
  ];

function RosterGroup({
  title,
  rows,
  canManage,
  busyPerson,
  onRole,
  onEnd,
  emptyText,
}: {
  title: string;
  rows: OrganisationMembership[];
  canManage: boolean;
  busyPerson: number | null;
  onRole: (member: OrganisationMembership, role: string) => void;
  onEnd: (member: OrganisationMembership) => void;
  emptyText: string;
}) {
  return (
    <div className="organisations-roster-group">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        // Always rendered, never omitted: an empty group and an absent one look
        // identical, and that ambiguity is what made the delete guard unreadable.
        <p className="organisations-roster-empty">{emptyText}</p>
      ) : (
        <ul className="organisations-roster-list">
          {rows.map((member) => (
            <li key={member.id} className="organisations-roster-row">
              <span className="organisations-roster-name">
                {member.person_name ?? `Person ${member.person_id}`}
                {member.status === "suspended" && (
                  <span className="organisations-roster-tag">Suspended</span>
                )}
              </span>
              {canManage ? (
                <>
                  <select
                    aria-label={`Role for ${member.person_name ?? member.person_id}`}
                    value={member.role}
                    disabled={busyPerson === member.person_id}
                    onChange={(event) => onRole(member, event.target.value)}
                  >
                    {MEMBERSHIP_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busyPerson === member.person_id}
                    onClick={() => onEnd(member)}
                  >
                    {member.status === "pending" ? "Remove" : "Remove"}
                  </button>
                </>
              ) : (
                <span className="organisations-roster-role">
                  {member.role_label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Add somebody to the roster by searching existing people.
 *
 * "Add", not "invite": the server makes a new membership active immediately,
 * because nothing in this system can accept an invitation — there is no acceptance
 * endpoint and no inbox, and for an accountless person no channel to respond
 * through at all. Offering a verb the system cannot complete would be a lie.
 *
 * Search rather than a player picker: only 6 of 22 people in development have a
 * player profile, and membership is keyed on `Person` precisely so a coach or a
 * committee member can belong to a club. A picker over players would hide most of
 * the people a club actually needs to record.
 */
function AddMemberForm({
  organisationId,
  existingPersonIds,
  onCancel,
  onAdded,
}: {
  organisationId: number;
  existingPersonIds: number[];
  onCancel: () => void;
  onAdded: (membership: OrganisationMembership) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PersonIdentity[]>([]);
  const [role, setRole] = useState<OrganisationMembershipRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (term.trim().length < 2) return;

    let cancelled = false;
    // Debounced so a typeahead is one request per pause, not one per keystroke.
    const timer = setTimeout(() => {
      api
        .people({ q: term.trim() })
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Derived rather than cleared in the effect: emptying the field must hide the
  // previous results, and doing that by setting state synchronously inside the
  // effect is the cascading-render pattern the lint rule exists to catch. Stale
  // results stay in state and are simply not rendered.
  const visibleResults = term.trim().length < 2 ? [] : results;

  const add = async (person: PersonIdentity) => {
    setSaving(true);
    setError(null);
    try {
      onAdded(
        await api.addOrganisationMember(organisationId, person.id, { role }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That person could not be added.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="organisations-add">
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      <label className="admin-field">
        Find a person
        <input
          value={term}
          placeholder="Search by name"
          onChange={(event) => setTerm(event.target.value)}
        />
      </label>
      <label className="admin-field">
        Role
        <select
          value={role}
          onChange={(event) =>
            setRole(event.target.value as OrganisationMembershipRole)
          }
        >
          {MEMBERSHIP_ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {visibleResults.length > 0 && (
        <ul className="organisations-add-results">
          {results.map((person) => {
            const already = existingPersonIds.includes(person.id);
            return (
              <li key={person.id}>
                <span>{person.full_name}</span>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={already || saving}
                  onClick={() => add(person)}
                >
                  {already ? "Already on roster" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="admin-btn" onClick={onCancel}>
        <X size={14} /> Cancel
      </button>
    </div>
  );
}

function NewOrganisationForm({
  organisations,
  onCancel,
  onCreated,
}: {
  organisations: Organisation[];
  onCancel: () => void;
  /** `logoError` is set when the organisation was created but its logo was not. */
  onCreated: (created: Organisation, logoError?: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [acronym, setAcronym] = useState("");
  const [type, setType] = useState<OrganisationType>("club");
  const [parentId, setParentId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the organisation a name.");
      return;
    }
    // Checked *before* creating, not after. The logo is a second request, so a
    // file the server would reject would otherwise leave an organisation created
    // with no crest and an error the user reads as "nothing happened".
    if (logo && !LOGO_ACCEPT.split(",").includes(logo.type)) {
      setError("A logo must be a PNG, JPEG, GIF, WEBP or SVG.");
      return;
    }
    if (logo && logo.size > MAX_LOGO_BYTES) {
      setError("A logo must be smaller than 10 MB.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: OrganisationInput = {
        name: name.trim(),
        acronym: acronym.trim() || null,
        description: description.trim() || null,
        organisation_type: type,
        parent_organisation_id: parentId === "" ? null : parentId,
      };

      const created = await api.createOrganisation(payload);
      let result = created;
      // The logo is a separate multipart endpoint, so this is unavoidably two
      // requests. If the upload fails the organisation still exists, so it is
      // reported as a partial success rather than rolled back or hidden.
      let logoError: string | null = null;
      if (logo) {
        try {
          result = await api.uploadOrganisationLogo(created.id, logo);
        } catch (err) {
          logoError =
            err instanceof Error ? err.message : "The logo could not be uploaded.";
        }
      }
      onCreated(result, logoError);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The organisation could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="organisations-form" onSubmit={submit}>
      <h2>
        <Layers size={16} /> New organisation
      </h2>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      <label className="admin-field">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <label className="admin-field">
        Acronym
        <input
          value={acronym}
          placeholder="e.g. FIVB"
          onChange={(event) => setAcronym(event.target.value)}
        />
      </label>

      <label className="admin-field">
        Logo
        {/* Optional here, and uploaded as a second request once the organisation
            exists — the API takes the logo on its own multipart route so `create`
            keeps a single content-type contract. */}
        <input
          type="file"
          accept={LOGO_ACCEPT}
          aria-label="Logo"
          onChange={(event) => {
            setLogo(event.target.files?.[0] ?? null);
            // Cleared so re-picking the same file fires a change again.
            event.target.value = "";
          }}
        />
      </label>

      <label className="admin-field">
        Type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as OrganisationType)}
        >
          {ORGANISATION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        Parent organisation
        <select
          value={parentId}
          onChange={(event) =>
            setParentId(
              event.target.value === "" ? "" : Number(event.target.value),
            )
          }
        >
          {/* Blank is a legitimate choice: an independent root, which the spec
              requires a Group-less organisation to be able to be. */}
          <option value="">None — this is a top-level organisation</option>
          {organisations.map((organisation) => (
            <option key={organisation.id} value={organisation.id}>
              {organisation.name}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        Description
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="admin-form-actions">
        <button
          type="submit"
          className="admin-btn admin-btn-add"
          disabled={saving}
        >
          {saving ? "Creating..." : "Create organisation"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          <X size={14} />
          Cancel
        </button>
      </div>
    </form>
  );
}
