import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ImageUp, Layers, Plus, UsersRound, X } from "lucide-react";
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

  const load = useCallback(() => {
    // Every setState here is inside a promise callback, never synchronously in the
    // effect body — a synchronous one cascades an extra render on every load. Same
    // shape as Groups.
    return api
      .organisations(showArchived ? "archived" : "active")
      .then((page) => {
        setOrganisations(page.data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load organisations."),
      );
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (saved: Organisation) => {
    setOrganisations((current) => [saved, ...current.filter((o) => o.id !== saved.id)]);
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
      setError(err instanceof Error ? err.message : "The action could not be completed.");
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
      setOrganisations((current) => current.filter((o) => o.id !== organisation.id));
      setNotice(`${organisation.name} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The organisation could not be deleted.");
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
      setError(err instanceof Error ? err.message : "The logo could not be uploaded.");
    } finally {
      setUploadingId(null);
    }
  };

  // --- tree ----------------------------------------------------------------
  //
  // Built from the flat list rather than fetched recursively: each row carries its
  // parent, so the whole visible tree arrives in one request and no endpoint has to
  // return an unbounded structure by default.
  const tree = useMemo(() => {
    const byParent = new Map<number | null, Organisation[]>();
    organisations.forEach((organisation) => {
      const siblings = byParent.get(organisation.parent_organisation_id) ?? [];
      siblings.push(organisation);
      byParent.set(organisation.parent_organisation_id, siblings);
    });

    const rows: Array<{ organisation: Organisation; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      (byParent.get(parentId) ?? []).forEach((organisation) => {
        rows.push({ organisation, depth });
        walk(organisation.id, depth + 1);
      });
    };
    walk(null, 0);
    return rows;
  }, [organisations]);

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
          onCreated={(created) => {
            replace(created);
            setShowNew(false);
            setNotice(`${created.name} created.`);
          }}
        />
      )}

      {tree.length === 0 ? (
        <EmptyState
          title="No organisations yet"
          description="An organisation is a club, academy or federation. Create the top of the tree first, then add what sits under it."
        />
      ) : (
        <ul className="organisations-tree">
          {tree.map(({ organisation, depth }) => (
            <li
              key={organisation.id}
              className="organisations-row"
              style={{ paddingLeft: `${depth * 1.5}rem` }}
            >
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
                  {organisation.acronym ?? organisation.name.slice(0, 2).toUpperCase()}
                </span>
              )}

              <div className="organisations-row-body">
                <span className="organisations-row-name">{organisation.name}</span>
                <span className="organisations-row-meta">
                  {organisation.organisation_type.replace(/_/g, " ")}
                  {" · "}
                  {organisation.child_count} child
                  {organisation.child_count === 1 ? "" : "ren"}
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
                      setRosterId(rosterId === organisation.id ? null : organisation.id);
                    }}
                  >
                    <UsersRound size={14} />
                    {rosterId === organisation.id ? "Close roster" : "Members"}
                  </button>
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

              {/* The form sits inside the row rather than in a panel at the top, so
                  the thing being edited stays in the place it lives in the tree. */}
              {editingId === organisation.id && (
                <EditOrganisationForm
                  organisation={organisation}
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
                  canManage={organisation.can_edit}
                  onClose={() => setRosterId(null)}
                />
              )}
            </li>
          ))}
        </ul>
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
    </div>
  );
}

/**
 * Edit an existing organisation's own record: its name, type and description.
 *
 * Deliberately no parent selector. Moving a node in the federation tree asserts its
 * place to every other club, so it stays admin-only on the server — offering the
 * control here would render a field the submit would silently drop.
 */
function EditOrganisationForm({
  organisation,
  onCancel,
  onSaved,
}: {
  organisation: Organisation;
  onCancel: () => void;
  onSaved: (saved: Organisation) => void;
}) {
  const [name, setName] = useState(organisation.name);
  const [acronym, setAcronym] = useState(organisation.acronym ?? "");
  const [type, setType] = useState<OrganisationType>(organisation.organisation_type);
  const [description, setDescription] = useState(organisation.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The organisation could not be saved.",
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

      <label className="admin-field">
        Description
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
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
 * The roster of one organisation: who belongs, who has been invited, who left.
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
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers((await api.organisationMembers(organisation.id)).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The roster could not be loaded.");
    }
  }, [organisation.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (member: OrganisationMembership, role: string) => {
    setBusyPerson(member.person_id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateOrganisationMember(organisation.id, member.person_id, {
        role: role as OrganisationMembershipRole,
      });
      setMembers((current) =>
        (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
      );
      setNotice(`${updated.person_name} is now ${updated.role_label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The role could not be changed.");
    } finally {
      setBusyPerson(null);
    }
  };

  // One call either way, because the server decides: a real member's row survives
  // as `ended`, while an unaccepted invitation is removed outright.
  const endOrWithdraw = async (member: OrganisationMembership) => {
    const verb =
      member.status === "pending" ? "Withdraw the invitation to" : "End the membership of";
    if (!window.confirm(`${verb} ${member.person_name}?`)) return;

    setBusyPerson(member.person_id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.endOrganisationMember(organisation.id, member.person_id);
      setMembers((current) =>
        result.removed
          ? (current ?? []).filter((row) => row.person_id !== member.person_id)
          : (current ?? []).map((row) =>
              row.person_id === member.person_id && result.membership
                ? result.membership
                : row,
            ),
      );
      setNotice(result.message ?? `${member.person_name} removed from the roster.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be changed.");
    } finally {
      setBusyPerson(null);
    }
  };

  const all = members ?? [];
  const invitations = all.filter((m) => m.status === "pending");
  const active = all.filter((m) => m.status === "active" || m.status === "suspended");
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

      {error && <div className="admin-error" role="alert">{error}</div>}
      {notice && <p className="admin-success" role="status">{notice}</p>}

      {members === null && !error && (
        <p className="organisations-roster-empty">Loading…</p>
      )}

      {canManage && (
        <div className="organisations-roster-invite">
          {inviting ? (
            <InviteMemberForm
              organisationId={organisation.id}
              existingPersonIds={all.map((m) => m.person_id)}
              onCancel={() => setInviting(false)}
              onInvited={(membership) => {
                setMembers([...all, membership]);
                setInviting(false);
                setNotice(`Invited ${membership.person_name}.`);
              }}
            />
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => setInviting(true)}
            >
              <Plus size={14} /> Invite someone
            </button>
          )}
        </div>
      )}

      {members !== null && all.length === 0 && (
        <p className="organisations-roster-empty">Nobody is recorded here yet.</p>
      )}

      <RosterGroup
        title={`Invitations (${invitations.length})`}
        rows={invitations}
        canManage={canManage}
        busyPerson={busyPerson}
        onRole={changeRole}
        onEnd={endOrWithdraw}
        emptyText="No outstanding invitations."
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

const MEMBERSHIP_ROLES: { value: OrganisationMembershipRole; label: string }[] = [
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
        // Always rendered, never omitted: an absent invitation list and an empty
        // roster look identical, and the difference is what makes the delete guard
        // understandable.
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
                    {member.status === "pending" ? "Withdraw" : "Remove"}
                  </button>
                </>
              ) : (
                <span className="organisations-roster-role">{member.role_label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Invite somebody by searching existing people.
 *
 * Search rather than a player picker: only 6 of 22 people in development have a
 * player profile, and membership is keyed on `Person` precisely so a coach or a
 * committee member can belong to a club. A picker over players would hide most of
 * the people a club actually needs to record.
 */
function InviteMemberForm({
  organisationId,
  existingPersonIds,
  onCancel,
  onInvited,
}: {
  organisationId: number;
  existingPersonIds: number[];
  onCancel: () => void;
  onInvited: (membership: OrganisationMembership) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PersonIdentity[]>([]);
  const [role, setRole] = useState<OrganisationMembershipRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
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

  const invite = async (person: PersonIdentity) => {
    setSaving(true);
    setError(null);
    try {
      onInvited(await api.addOrganisationMember(organisationId, person.id, { role }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The invitation could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="organisations-invite">
      {error && <div className="admin-error" role="alert">{error}</div>}
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
          onChange={(event) => setRole(event.target.value as OrganisationMembershipRole)}
        >
          {MEMBERSHIP_ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {results.length > 0 && (
        <ul className="organisations-invite-results">
          {results.map((person) => {
            const already = existingPersonIds.includes(person.id);
            return (
              <li key={person.id}>
                <span>{person.full_name}</span>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={already || saving}
                  onClick={() => invite(person)}
                >
                  {already ? "Already on roster" : "Invite"}
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
  onCreated: (created: Organisation) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganisationType>("club");
  const [parentId, setParentId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the organisation a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: OrganisationInput = {
        name: name.trim(),
        description: description.trim() || null,
        organisation_type: type,
        parent_organisation_id: parentId === "" ? null : parentId,
      };
      onCreated(await api.createOrganisation(payload));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The organisation could not be created.",
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
      {error && <div className="admin-error" role="alert">{error}</div>}

      <label className="admin-field">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
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
            setParentId(event.target.value === "" ? "" : Number(event.target.value))
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
