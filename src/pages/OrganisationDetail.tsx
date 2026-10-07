import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ImageUp, Trash2, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type Organisation,
  type OrganisationMemberCandidate,
  type OrganisationMembership,
  type OrganisationMemberInput,
  type OrganisationMembershipRole,
  type OrganisationType,
} from "../api";

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

const MEMBERSHIP_ROLES: Array<{ value: OrganisationMembershipRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "administrator", label: "Administrator" },
  { value: "coach", label: "Coach" },
  { value: "member", label: "Member" },
];

const LOGO_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
const MAX_LOGO_BYTES = 10 * 1024 * 1024;

export default function OrganisationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const organisationId = Number(id);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(organisationId)) return;
    try {
      const [detail, page] = await Promise.all([
        api.organisation(organisationId),
        api.organisations(undefined, undefined, true),
      ]);
      setOrganisation(detail);
      setOrganisations(page.data);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load organisation.");
    }
  }, [organisationId]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const saveOrganisation = (saved: Organisation) => {
    setOrganisation(saved);
    setOrganisations((current) => [saved, ...current.filter((org) => org.id !== saved.id)]);
  };

  const uploadLogo = async (file: File) => {
    if (!organisation) return;
    if (!LOGO_ACCEPT.split(",").includes(file.type)) {
      setError("A logo must be a PNG, JPEG, GIF, WEBP or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("A logo must be smaller than 10 MB.");
      return;
    }

    setBusy("logo");
    setError(null);
    setNotice(null);
    try {
      const saved = await api.uploadOrganisationLogo(organisation.id, file);
      saveOrganisation(saved);
      setNotice(`Logo updated for ${organisation.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The logo could not be uploaded.");
    } finally {
      setBusy(null);
    }
  };

  const archiveOrRestore = async () => {
    if (!organisation) return;
    setBusy("archive");
    setError(null);
    setNotice(null);
    try {
      const saved = organisation.status === "archived"
        ? await api.restoreOrganisation(organisation.id)
        : await api.archiveOrganisation(organisation.id);
      saveOrganisation(saved);
      setNotice(`${saved.name} ${saved.status === "archived" ? "archived" : "restored"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  const deleteOrganisation = async () => {
    if (!organisation) return;
    if (!window.confirm(`Delete ${organisation.name} permanently? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    setNotice(null);
    try {
      await api.deleteOrganisation(organisation.id);
      navigate("/organisations", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The organisation could not be deleted.");
      setBusy(null);
    }
  };

  if (error && !organisation) {
    return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  }

  if (!organisation) return <div className="loading">Loading…</div>;

  return (
    <div className="page organisation-detail-page">
      <header className="page-header organisation-detail-header">
        <div className="organisation-detail-title">
          {organisation.logo_url ? (
            <img className="organisations-logo" src={organisation.logo_url} alt="" />
          ) : (
            <span className="organisations-logo organisations-logo-fallback" aria-hidden="true">
              {organisation.acronym ?? organisation.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <h1>{organisation.name}</h1>
            <p>{organisation.description || organisation.organisation_type.replaceAll("_", " ")}</p>
          </div>
        </div>
        <Link className="admin-btn" to="/organisations">Back to organisations</Link>
      </header>

      {error && <div className="admin-error" role="alert"><AlertCircle size={16} /> <span>{error}</span></div>}
      {notice && !error && <p className="admin-success" role="status">{notice}</p>}

      <section className="detail-section">
        <div className="organisations-detail-section-head">
          <h2>Details</h2>
          <div className="organisations-row-actions">
            {organisation.can_edit && !editing && (
              <button type="button" className="admin-btn" onClick={() => setEditing(true)}>Edit</button>
            )}
            {organisation.can_edit && (
              <label className="organisations-logo-upload">
                <ImageUp size={14} aria-hidden="true" /> Upload logo
                <input
                  type="file"
                  accept={LOGO_ACCEPT}
                  aria-label={`Upload logo for ${organisation.name}`}
                  disabled={busy === "logo"}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void uploadLogo(file);
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {editing ? (
          <OrganisationEditForm
            organisation={organisation}
            organisations={organisations}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              saveOrganisation(saved);
              setEditing(false);
              setNotice(`${saved.name} updated.`);
              setError(null);
            }}
          />
        ) : (
          <dl className="identity-context">
            <dt>Type</dt><dd>{organisation.organisation_type.replaceAll("_", " ")}</dd>
            <dt>Status</dt><dd>{organisation.status_label}</dd>
            {organisation.acronym && <><dt>Acronym</dt><dd>{organisation.acronym}</dd></>}
            {organisation.parent_organisation && <><dt>Parent organisation</dt><dd><Link className="identity-link" to={`/organisations/${organisation.parent_organisation.id}`}>{organisation.parent_organisation.name}</Link></dd></>}
            <dt>Children</dt><dd>{organisation.child_count}</dd>
          </dl>
        )}
      </section>

      <section className="detail-section">
        <h2>Lifecycle</h2>
        <div className="form-actions">
          {organisation.can_edit && (
            <button type="button" className="admin-btn" onClick={archiveOrRestore} disabled={busy === "archive"}>
              {organisation.status === "archived" ? "Restore" : "Archive"}
            </button>
          )}
          {organisation.can_delete && (
            <button type="button" className="admin-btn admin-btn-danger" onClick={deleteOrganisation} disabled={busy === "delete"}>
              <Trash2 size={14} /> Delete permanently
            </button>
          )}
          {!organisation.can_edit && !organisation.can_delete && <p>You do not have management rights for this organisation.</p>}
        </div>
      </section>

      <OrganisationRoster organisation={organisation} />
    </div>
  );
}

function OrganisationEditForm({
  organisation,
  organisations,
  onCancel,
  onSaved,
}: {
  organisation: Organisation;
  organisations: Organisation[];
  onCancel: () => void;
  onSaved: (saved: Organisation) => void;
}) {
  const [name, setName] = useState(organisation.name);
  const [acronym, setAcronym] = useState(organisation.acronym ?? "");
  const [type, setType] = useState<OrganisationType>(organisation.organisation_type);
  const [description, setDescription] = useState(organisation.description ?? "");
  const [parentId, setParentId] = useState<number | null>(organisation.parent_organisation_id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => parentCandidates(organisations, organisation.id), [organisations, organisation.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please give the organisation a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api.updateOrganisation(organisation.id, {
        name: name.trim(),
        acronym: acronym.trim() || null,
        organisation_type: type,
        description: description.trim() || null,
        parent_organisation_id: parentId,
      });
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to update organisation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="organisations-edit-form" onSubmit={handleSubmit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-row"><label htmlFor="org-name">Name</label><input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} required /></div>
      <div className="form-row"><label htmlFor="org-acronym">Acronym</label><input id="org-acronym" value={acronym} onChange={(e) => setAcronym(e.target.value)} disabled={busy} /></div>
      <div className="form-row"><label htmlFor="org-type">Type</label><select id="org-type" value={type} onChange={(e) => setType(e.target.value as OrganisationType)} disabled={busy}>{ORGANISATION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="form-row"><label htmlFor="org-description">Description</label><textarea id="org-description" value={description} rows={3} onChange={(e) => setDescription(e.target.value)} disabled={busy} /></div>
      <div className="form-row"><label htmlFor="org-parent">Parent organisation</label><select id="org-parent" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)} disabled={busy}><option value="">— No parent (top level) —</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></div>
      <div className="form-actions"><button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}

function OrganisationRoster({ organisation }: { organisation: Organisation }) {
  const [memberships, setMemberships] = useState<OrganisationMembership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.organisationMembers(organisation.id);
      setMemberships(result.data);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load roster.");
    }
  }, [organisation.id]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const changeRole = async (membership: OrganisationMembership, role: OrganisationMembershipRole) => {
    setBusyId(membership.id);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.updateOrganisationMembership(organisation.id, membership.id, { role });
      setMemberships((current) => current.map((item) => item.id === saved.id ? saved : item));
      setNotice(`${saved.person_name ?? "Member"} is now ${saved.role_label}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to update member.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (membership: OrganisationMembership) => {
    if (!window.confirm(`Remove ${membership.person_name ?? "this member"} from ${organisation.name}?`)) return;
    setBusyId(membership.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.endOrganisationMembership(organisation.id, membership.id);
      if (result.removed) {
        setMemberships((current) => current.filter((item) => item.id !== membership.id));
        setNotice(`Invitation to ${membership.person_name ?? "member"} withdrawn.`);
      } else if (result.membership) {
        const saved = result.membership;
        setMemberships((current) => current.map((item) => item.id === saved.id ? saved : item));
        setNotice(`${result.membership.person_name ?? "Member"} removed from active roster.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to remove member.");
    } finally {
      setBusyId(null);
    }
  };

  const active = memberships.filter((membership) => membership.status !== "ended");
  const former = memberships.filter((membership) => membership.status === "ended");

  return (
    <section className="detail-section organisations-roster-detail">
      <div className="organisations-roster-head">
        <h2><UsersRound size={18} /> Members</h2>
        {organisation.can_manage_members && <button type="button" className="admin-btn" onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Cancel adding" : "Add someone"}</button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && !error && <p className="admin-success" role="status">{notice}</p>}
      {showAdd && organisation.can_manage_members && <AddMemberForm organisation={organisation} memberships={memberships} onAdded={(membership) => { setMemberships((current) => [membership, ...current.filter((item) => item.person_id !== membership.person_id)]); setShowAdd(false); setNotice(`${membership.person_name ?? "Member"} added to the roster.`); }} onError={setError} />}
      <RosterGroup title={`Active members (${active.length})`} memberships={active} canManage={organisation.can_manage_members} busyId={busyId} onRoleChange={changeRole} onRemove={remove} />
      {former.length > 0 && <RosterGroup title={`Former members (${former.length})`} memberships={former} canManage={false} busyId={busyId} onRoleChange={changeRole} onRemove={remove} />}
    </section>
  );
}

function RosterGroup({
  title,
  memberships,
  canManage,
  busyId,
  onRoleChange,
  onRemove,
}: {
  title: string;
  memberships: OrganisationMembership[];
  canManage: boolean;
  busyId: number | null;
  onRoleChange: (membership: OrganisationMembership, role: OrganisationMembershipRole) => void;
  onRemove: (membership: OrganisationMembership) => void;
}) {
  return (
    <div className="organisations-roster-group">
      <h4>{title}</h4>
      {memberships.length === 0 ? <p className="organisations-roster-empty">No members.</p> : (
        <ul className="organisations-roster-list">
          {memberships.map((membership) => (
            <li className="organisations-roster-row" key={membership.person_id}>
              <span className="organisations-roster-name">{membership.person_name ?? `Person #${membership.person_id}`} <span className="organisations-roster-tag">{membership.status_label}</span></span>
              {canManage ? (
                <select aria-label={`Role for ${membership.person_name ?? membership.person_id}`} value={membership.role} disabled={busyId === membership.person_id} onChange={(e) => onRoleChange(membership, e.target.value as OrganisationMembershipRole)}>{MEMBERSHIP_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
              ) : <span className="organisations-roster-role">{membership.role_label}</span>}
              {canManage && <button type="button" className="admin-btn admin-btn-danger" disabled={busyId === membership.person_id} onClick={() => onRemove(membership)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddMemberForm({
  organisation,
  memberships,
  onAdded,
  onError,
}: {
  organisation: Organisation;
  memberships: OrganisationMembership[];
  onAdded: (membership: OrganisationMembership) => void;
  onError: (message: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<OrganisationMemberCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<OrganisationMembershipRole>("member");
  const [busy, setBusy] = useState(false);
  const existingKeys = useMemo(() => new Set(memberships.map((membership) => `${membership.memberable_type ?? membership.member_type ?? "Account"}:${membership.memberable_id ?? membership.member_id ?? membership.account_id ?? membership.person_id}`)), [memberships]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    api.organisationMemberCandidates(organisation.id, query.trim())
      .then((result) => { if (!cancelled) setCandidates(result); })
      .catch((reason) => { if (!cancelled) onError(reason instanceof Error ? reason.message : "Failed to search members."); });
    return () => { cancelled = true; };
  }, [organisation.id, query, onError]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selected = candidates.find((candidate) => candidate.id === selectedId);
    if (!selected) {
      onError("Choose a person to add.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const payload: OrganisationMemberInput = selected.account_id
        ? { account_id: selected.account_id }
        : { memberable_type: selected.memberable_type, memberable_id: selected.memberable_id };
      const membership = await api.addOrganisationMember(organisation.id, payload, { role });
      onAdded(membership);
      setQuery("");
      setCandidates([]);
      setSelectedId(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="organisations-add" onSubmit={submit}>
      <div className="form-row"><label htmlFor="member-search">Search by name</label><input id="member-search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} disabled={busy} /></div>
      {candidates.length > 0 && <ul className="organisations-add-results">{candidates.map((candidate) => { const key = `${candidate.memberable_type}:${candidate.memberable_id}`; const exists = existingKeys.has(key); return <li key={candidate.id}><span>{candidate.display_name}<small> {candidate.member_type_label}</small></span><button type="button" className="admin-btn" disabled={exists || busy} onClick={() => setSelectedId(candidate.id)}>{exists ? "Already on roster" : selectedId === candidate.id ? "Selected" : "Select"}</button></li>; })}</ul>}
      <div className="form-row"><label htmlFor="member-role">Role</label><select id="member-role" value={role} onChange={(e) => setRole(e.target.value as OrganisationMembershipRole)} disabled={busy}>{MEMBERSHIP_ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="form-actions"><button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>{busy ? "Adding…" : "Add"}</button></div>
    </form>
  );
}

function parentCandidates(organisations: Organisation[], id: number): Organisation[] {
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