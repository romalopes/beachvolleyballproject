import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Plus, Search, Trash2, X } from "lucide-react";
import {
  api,
  type Group as GroupRecord,
  type GroupDetail,
  type GroupInput,
  type GroupVisibility,
  type Organisation,
  type OrganisationMembership,
} from "../api";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

/**
 * Groups are reusable rosters ("U19 squad"). A group exists purely so a coach
 * picking participants for a session does not re-search the same twenty people;
 * membership confers no access and no attendance. That is why this screen is a
 * plain CRUD list with no per-member status and no scoring, and why a group that
 * has already run sessions is archived rather than deleted.
 */
export default function Groups() {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Which query the rows on screen belong to. `loading` is derived from it
  // rather than synced by an effect, so flipping the archived toggle does not
  // cost an extra render pass (the AdminUsers.tsx pattern).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const queryKey = showArchived ? "all" : "active";
  const loading = loadedKey !== queryKey;

  // The editor holds either a brand new group or an existing one.
  const [editing, setEditing] = useState<GroupDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<GroupInput>({
    name: "",
    description: "",
    visibility: "shared",
    organisation_id: null,
  });
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [myOrganisations, setMyOrganisations] = useState<Organisation[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganisationMembership[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingOrgMembers, setLoadingOrgMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    return api
      .groups({ status: showArchived ? "all" : "active", include_private: true })
      .then((res) => {
        setGroups(res.data);
        setError(null);
        setLoadedKey(queryKey);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load groups.");
        setLoadedKey(queryKey);
      });
  }, [showArchived, queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (!showArchived && g.status === "archived") return false;
      if (!term) return true;
      return (
        g.name.toLowerCase().includes(term) ||
        (g.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [groups, search, showArchived]);

  

  const loadMyOrganisations = async () => {
    if (myOrganisations.length > 0) return;
    setLoadingOrgs(true);
    try {
      const res = await api.organisations("active", undefined, false, true);
      setMyOrganisations(res.data);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load organisations.",
      );
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadOrgMembers = async (organisationId: number) => {
    setLoadingOrgMembers(true);
    try {
      const res = await api.organisationMembers(organisationId);
      // res.data is OrganisationMembership[] (the data property of OrganisationMembershipList)
      const activeMembers = res.data.filter((m) => m.status === "active");
      setOrgMembers(activeMembers);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load organisation members.",
      );
    } finally {
      setLoadingOrgMembers(false);
    }
  };

  const handleOrganisationChange = async (organisationId: number | null) => {
    setForm((prev) => ({ ...prev, organisation_id: organisationId }));
    setMemberIds([]);
    if (organisationId) {
      await loadOrgMembers(organisationId);
    } else {
      setOrgMembers([]);
    }
  };

  const openCreate = async () => {
    setIsCreating(true);
    setEditing(null);
    setForm({
      name: "",
      description: "",
      visibility: "shared",
      organisation_id: null,
    });
    setMemberIds([]);
    setFormError(null);
    await loadMyOrganisations();
  };

  const openEdit = async (group: GroupRecord) => {
    setIsCreating(false);
    setFormError(null);
    try {
      await loadMyOrganisations();
      const detail = await api.group(group.id);
      setEditing(detail.group);
      setForm({
        name: detail.group.name,
        description: detail.group.description ?? "",
        visibility: detail.group.visibility,
        status: detail.group.status,
        organisation_id: detail.group.organisation?.id ?? null,
      });
      // memberIds are now person_ids (not player_profile_ids)
      setMemberIds(detail.group.members.map((m) => m.person_id));
      if (detail.group.organisation?.id) {
        await loadOrgMembers(detail.group.organisation.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group.");
    }
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setIsCreating(false);
    setFormError(null);
  };

  const toggleMember = (id: number) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("A name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.updateGroup(editing.id, form, memberIds);
      } else {
        await api.createGroup(form, memberIds);
      }
      setEditing(null);
      setIsCreating(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save the group.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (group: GroupRecord) => {
    setError(null);
    try {
      await api.updateGroup(group.id, {
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        status: group.status === "archived" ? "active" : "archived",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group.");
    }
  };

  const handleDelete = async (group: GroupRecord) => {
    // The server refuses to delete a group that has run sessions and says so in
    // its error message; confirming first keeps that refusal from surprising
    // anyone mid-flow.
    const ok = window.confirm(
      `Delete "${group.name}"? A group that has already run assessment sessions must be archived instead.`,
    );
    if (!ok) return;

    setError(null);
    try {
      await api.deleteGroup(group.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  const renderEditor = () => (
    <form onSubmit={handleSubmit}>
      {formError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{formError}</span>
        </div>
      )}

      <div className="admin-field">
        <label htmlFor="group-name">Name *</label>
        <input
          id="group-name"
          type="text"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g. U19 squad"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="group-description">Description</label>
        <textarea
          id="group-description"
          rows={2}
          value={form.description ?? ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Optional context for this roster"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="group-visibility">Visibility</label>
        <select
          id="group-visibility"
          value={form.visibility ?? "shared"}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              visibility: e.target.value as GroupVisibility,
            }))
          }
        >
          <option value="shared">Shared — every coach can pick this group</option>
          <option value="private">Private — only me, curators and admins</option>
        </select>
        <p className="field-hint">
          Visibility is presentation only. It never decides who may be scheduled.
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="group-organisation">Organisation</label>
        <select
          id="group-organisation"
          value={form.organisation_id ?? ""}
          onChange={(e) =>
            handleOrganisationChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={loadingOrgs}
        >
          <option value="">— Select organisation —</option>
          {loadingOrgs ? (
            <option disabled>Loading…</option>
          ) : (
            myOrganisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))
          )}
        </select>
        <p className="field-hint">
          A group belongs to one organisation. Only active members of that
          organisation can be added to the roster.
        </p>
      </div>

      <div className="admin-field">
        <span className="group-roster-label" id="group-members-label">
          Roster ({memberIds.length})
        </span>
        <div
          className="consolidation-session-picker group-member-picker"
          role="group"
          aria-labelledby="group-members-label"
        >
          {/* No role/label of its own: the wrapper above already names the group,
              and a second identically-labelled group would be ambiguous. */}
          <div className="session-picker-list">
            {!form.organisation_id ? (
              <p className="candidate-empty">
                Select an organisation to see its members.
              </p>
            ) : loadingOrgMembers ? (
              <p className="candidate-empty">Loading members…</p>
            ) : orgMembers.length === 0 ? (
              <p className="candidate-empty">
                No active members in this organisation.
              </p>
            ) : (
              orgMembers.map((member) => {
                const checked = memberIds.includes(member.person_id);
                return (
                  <label
                    key={member.person_id}
                    className={
                      checked
                        ? "consolidation-session-option selected"
                        : "consolidation-session-option"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(member.person_id)}
                    />
                    <span className="session-option-body">
                      <span className="session-option-name">
                        {member.person_name ?? "Unknown"}
                      </span>
                      <span className="session-option-meta">
                        {member.role_label}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Saving..." : editing ? "Save changes" : "Create group"}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={closeEditor}
        >
          Cancel
        </button>
      </div>
    </form>
  );


  return (
    <div className="page groups-page">
      <PageHeader
        title="Groups"
        description="Reusable rosters for assessment sessions. A group is a selection aid: membership is not attendance, and it grants no access."
      >
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => void openCreate()}
        >
          <Plus size={16} />
          New group
        </button>
      </PageHeader>

      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="groups-toolbar">
        <div className="groups-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search groups"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups"
          />
        </div>
        <label className="groups-archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a roster so you can fill a session roster without searching for the same players every time."
        />
      ) : (
        <ul className="group-list">
          {visibleGroups.map((group) => (
            <li key={group.id} className="group-row">
              <div className="group-row-main">
                <span className="group-name">{group.name}</span>
                {group.visibility === "private" && (
                  <span className="tag">Private</span>
                )}
                {group.status === "archived" && (
                  <span className="tag">Archived</span>
                )}
                <span className="group-meta">
                  {group.player_count} player
                  {group.player_count === 1 ? "" : "s"}
                  {group.organisation && (
                    <>
                      {" · "}
                      <span className="group-org">{group.organisation.name}</span>
                    </>
                  )}
                </span>
              </div>
              {group.description && (
                <p className="group-description">{group.description}</p>
              )}
              <div className="group-row-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => void openEdit(group)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => void handleArchiveToggle(group)}
                >
                  {group.status === "archived" ? "Restore" : "Archive"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  onClick={() => void handleDelete(group)}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(isCreating || editing) && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editing ? `Edit ${editing.name}` : "New group"}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeEditor}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{renderEditor()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

