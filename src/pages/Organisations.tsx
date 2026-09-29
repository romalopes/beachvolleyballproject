import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ImageUp, Layers, Plus, X } from "lucide-react";
import {
  api,
  type Organisation,
  type OrganisationInput,
  type OrganisationType,
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
                  aria-hidden="true"
                >
                  {organisation.name.slice(0, 2).toUpperCase()}
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
