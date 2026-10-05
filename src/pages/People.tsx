import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Copy, Link2, Pencil, Plus, Trash2, UserCheck, UserCircle, X } from "lucide-react";
import { api, ApiValidationError, type PaginationMeta, type PersonIdentity, type PersonInput } from "../api";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/settings/Pagination";

const PER_PAGE = 20;

/**
 * People: the identity behind every player and coach profile.
 *
 * A separate catalogue rather than a view over Players and Coaches, because a club
 * records people who have no profile at all — a committee member, a parent, a
 * volunteer coach — and a club's roster is keyed on Person precisely so they can be
 * on it. Listing only profiles would keep them invisible until somebody happened to
 * promote them.
 */
export default function People() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const [people, setPeople] = useState<PersonIdentity[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .peopleList({ q: query || undefined, page, per_page: PER_PAGE })
      .then((result) => {
        if (cancelled) return;
        setPeople(result.data);
        setMeta(result.meta);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "People could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, page]);

  // Search is submitted rather than typed: this is a paginated management list, and
  // filtering on every keystroke would refetch the page out from under the reader.
  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(term.trim());
  };

  const refresh = useCallback(async () => {
    const result = await api.peopleList({ q: query || undefined, page, per_page: PER_PAGE });
    setPeople(result.data);
    setMeta(result.meta);
  }, [query, page]);

  const promote = async (person: PersonIdentity, role: "player" | "coach") => {
    setBusyId(person.id);
    setError(null);
    setNotice(null);
    try {
      await api.promotePerson(person.id, role);
      setNotice(`${person.full_name} is now recorded as a ${role}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be changed.");
    } finally {
      setBusyId(null);
    }
  };

  const destroy = async (person: PersonIdentity) => {
    // Deliberately does NOT promise that the profiles go with them. They do not:
    // `Person` guards its associations with `restrict_with_error`, so a person
    // who has a player or coach profile is refused outright and nothing is
    // deleted. The old copy described a cascade that the server never performs.
    if (
      !window.confirm(
        `Delete ${person.full_name}? This is only possible if they have no account and no player or coach profiles.`,
      )
    ) {
      return;
    }
    setBusyId(person.id);
    setError(null);
    setNotice(null);
    try {
      await api.deletePerson(person.id);
      // Only claim success once the list has actually been reloaded, so the
      // confirmation can never describe a delete the reader cannot see.
      await refresh();
      setNotice(`${person.full_name} deleted.`);
    } catch (err) {
      setError(
        err instanceof ApiValidationError
          ? err.errors.join(" ")
          : err instanceof Error
            ? err.message
            : "That person could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader title="People">
        <p className="page-header-description">
          Everyone the project knows about, whether or not they play or coach. A club
          records committee members and parents here, and they can be put on a
          club&apos;s roster without ever becoming a player.
        </p>
      </PageHeader>

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

      <form className="people-toolbar" onSubmit={onSearch}>
        <input
          value={term}
          placeholder="Search by name or email"
          aria-label="Search people"
          onChange={(event) => setTerm(event.target.value)}
        />
        <button type="submit" className="admin-btn">
          Search
        </button>
        {query && (
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setTerm("");
              setQuery("");
              setPage(1);
            }}
          >
            <X size={14} /> Clear
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-add"
          onClick={() => setShowNew((open) => !open)}
        >
          <Plus size={14} /> New person
        </button>
      </form>

      {showNew && (
        <PersonForm
          onCancel={() => setShowNew(false)}
          onSaved={(created) => {
            setShowNew(false);
            setNotice(`${created.full_name} added.`);
            void refresh();
          }}
        />
      )}

      {people.length === 0 ? (
        <EmptyState
          title="No people found"
          description={
            query
              ? "Nobody matches that search."
              : "Record the first person, then give them a player or coach profile."
          }
        />
      ) : (
        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id} className="people-row">
              {editingId === person.id ? (
                <PersonForm
                  person={person}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    setEditingId(null);
                    setNotice(`${saved.full_name} updated.`);
                    void refresh();
                  }}
                />
              ) : (
                <>
                  <div className="people-row-main">
                    <span className="people-name">{person.full_name}</span>
                    <span className="people-meta">
                      {person.email || "No email"}
                      {person.phone ? ` · ${person.phone}` : ""}
                    </span>
                    <span className="people-tags">
                      <span className="people-tag">
                        {person.account_status === "connected"
                          ? "Has account"
                          : "Record only"}
                      </span>
                      {person.player_profile_id && (
                        <span className="people-tag people-tag-player">Player</span>
                      )}
                      {person.coach_profile_id && (
                        <span className="people-tag people-tag-coach">Coach</span>
                      )}
                    </span>
                  </div>

                  <div className="people-row-actions">
                    {person.account_status !== "connected" && (
                      <PersonAccountInvite person={person} disabled={busyId === person.id} />
                    )}
                    {isAdmin && !person.player_profile_id && (
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busyId === person.id}
                        onClick={() => void promote(person, "player")}
                      >
                        <UserCheck size={14} /> Make player
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busyId === person.id}
                        onClick={() => void promote(person, "coach")}
                      >
                        <UserCheck size={14} /> {person.coach_profile_id ? "Add coach profile" : "Make coach"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busyId === person.id}
                      onClick={() => setEditingId(person.id)}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    {/* Only for a person with no account. The server refuses to delete
                        somebody with one — `dependent: :restrict_with_error` on the
                        account, so a login is never silently orphaned — which means
                        for those people this button could only ever produce a 422.
                        Rendering it would offer an action guaranteed to fail. */}
                    {isAdmin && person.account_status !== "connected" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        disabled={busyId === person.id}
                        onClick={() => void destroy(person)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={(next) => {
            if (next === page) return;
            setError(null);
            setPage(next);
          }}
        />
      )}
    </div>
  );
}

function PersonAccountInvite({ person, disabled }: { person: PersonIdentity; disabled: boolean }) {
  const [invitation, setInvitation] = useState<Awaited<ReturnType<typeof api.personAccountInvitations>>[number] | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.personAccountInvitations(person.id).then((items) => {
      if (!cancelled) setInvitation(items.find((item) => item.status === "active") ?? null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [person.id]);
  const create = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const created = await api.createPersonAccountInvitation(person.id);
      const value = `${window.location.origin}/identity#account_claim_token=${encodeURIComponent(created.token)}`;
      setInvitation(created.invitation);
      setLink(value);
      setMessage(created.email_delivered ? `Invitation email sent to ${created.invitation.invitee_email}.` : `Copy and share this link with ${created.invitation.invitee_email}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Invitation could not be created."); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!invitation) return;
    setBusy(true); setError("");
    try { setInvitation(await api.revokePersonAccountInvitation(invitation.id)); setLink(""); setMessage("Invitation revoked."); }
    catch (err) { setError(err instanceof Error ? err.message : "Invitation could not be revoked."); }
    finally { setBusy(false); }
  };
  if (!person.email) return <span className="people-meta">Add an email to invite</span>;
  return <div className="person-account-invite">
    <button type="button" className="admin-btn" disabled={disabled || busy} onClick={() => void create()}><Link2 size={14} /> {busy ? "Creating…" : invitation?.status === "active" ? "Create new invite link" : "Invite to account"}</button>
    {invitation?.status === "active" && <button type="button" className="admin-btn" disabled={disabled || busy} onClick={() => void revoke()}>Revoke account invite</button>}
    {message && <span role="status">{message}</span>}{error && <span role="alert">{error}</span>}
    {link && <div><input aria-label={`Account invitation link for ${person.full_name}`} readOnly value={link} /><button type="button" className="admin-btn" onClick={() => void navigator.clipboard.writeText(link)}><Copy size={14} /> Copy link</button></div>}
  </div>;
}

function PersonForm({
  person,
  onCancel,
  onSaved,
}: {
  person?: PersonIdentity;
  onCancel: () => void;
  onSaved: (saved: PersonIdentity) => void;
}) {
  const [firstName, setFirstName] = useState(person?.first_name ?? "");
  const [lastName, setLastName] = useState(person?.last_name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) {
      setError("A person needs a first name.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: PersonInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    try {
      onSaved(
        person
          ? await api.updatePerson(person.id, payload)
          : await api.createPerson(payload),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That person could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="organisations-form people-form" onSubmit={submit}>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      <h3>
        <UserCircle size={15} /> {person ? `Edit ${person.full_name}` : "New person"}
      </h3>

      <label className="admin-field">
        First name
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label className="admin-field">
        Last name
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label className="admin-field">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="admin-field">
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn-add" disabled={saving}>
          {saving ? "Saving..." : person ? "Save changes" : "Add person"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  );
}
