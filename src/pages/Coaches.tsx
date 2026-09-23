import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Search,
  UserPlus,
} from "lucide-react";
import { api, type Coach, type PaginationMeta } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/settings/Pagination";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import Tag from "../components/Tag";
import PersonCreatePanel from "../components/people/PersonCreatePanel";
import {
  archiveCoach,
  canManageProfiles,
  isArchived,
  restoreCoach,
} from "../utils/people";

/** Page size for the coach catalogue (the API's own default). */
const PER_PAGE = 20;

/**
 * Coach catalogue.
 *
 * A CoachProfile describes what a person is in the volleyball domain — it is
 * not an authorization role. Being recorded here grants no application
 * permissions; those stay on the User's roles, which is why an accountless
 * coach can be listed without having access to anything.
 */
export default function Coaches() {
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // See Players: archived is an explicit mode, because the API filters a single
  // status at a time.
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState<Coach | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const term = search.trim();
    api
      .coaches({
        ...(term ? { q: term } : {}),
        status: showArchived ? "archived" : "active",
        page,
        per_page: PER_PAGE,
      })
      .then((response) => {
        if (cancelled) return;
        setCoaches(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load coaches.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, showArchived, page]);

  const reload = () => {
    const term = search.trim();
    api
      .coaches({
        ...(term ? { q: term } : {}),
        status: showArchived ? "archived" : "active",
        page,
        per_page: PER_PAGE,
      })
      .then((response) => {
        setCoaches(response.data);
        setMeta(response.meta);
      })
      .catch(console.error);
  };

  const handleArchive = async () => {
    if (!confirmingArchive) return;
    setWorking(true);
    setActionError(null);
    try {
      await archiveCoach(confirmingArchive.id);
      setConfirmingArchive(null);
      reload();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async (coach: Coach) => {
    setWorking(true);
    setActionError(null);
    try {
      await restoreCoach(coach.id);
      reload();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the coach.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Coaches"
        description="The coaching staff of the club, with or without an account."
      />

      <div className="people-toolbar">
        <label className="person-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search by name or email"
            aria-label="Search coaches"
            onChange={(event) => {
              setSearch(event.target.value);
              // A new search is a new result set: start from the first page.
              setPage(1);
            }}
          />
        </label>
        {canEdit && (
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => setCreating(true)}
          >
            <UserPlus size={14} />
            New coach
          </button>
        )}
      </div>

      <div className="people-filter">
        <label className="people-filter-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => {
              setShowArchived(event.target.checked);
              setPage(1);
            }}
          />
          <Archive size={14} aria-hidden="true" />
          Show archived
        </label>
      </div>

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={
            confirmingArchive.full_name ?? confirmingArchive.person.first_name
          }
          title={`Archive “${
            confirmingArchive.full_name ?? confirmingArchive.person.first_name
          }”?`}
          warning="The coach leaves the catalogue. Their record is kept, and this can be undone."
          confirmLabel="Archive"
          pendingLabel="Archiving..."
          deleting={working}
          error={null}
          onCancel={() => {
            setConfirmingArchive(null);
            setActionError(null);
          }}
          onConfirm={handleArchive}
        />
      )}

      {creating && (
        <PersonCreatePanel
          kind="coach"
          onCreated={reload}
          onClose={() => setCreating(false)}
        />
      )}

      {error && <div className="admin-error">{error}</div>}

      {loading && coaches.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : coaches.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived coaches" : "No coaches found"}
          description={
            search.trim()
              ? `No coach matches “${search.trim()}”.`
              : showArchived
                ? "Coaches you archive will be listed here, so they can be restored."
                : "Coaches recorded by the club will appear here."
          }
        />
      ) : (
        <ul className="people-list">
          {coaches.map((coach) => (
            <li key={coach.id} className="people-row">
              <div className="people-identity">
                <span className="people-name">
                  {coach.full_name ??
                    `${coach.person.first_name} ${coach.person.last_name ?? ""}`}
                </span>
                <span className="people-contact">
                  {[coach.person.email, coach.person.phone]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                </span>
              </div>
              <span className="people-meta">
                {[coach.coaching_level, coach.qualifications]
                  .filter(Boolean)
                  .join(" · ") || "No coaching details yet"}
              </span>
              <Tag>
                {coach.account_status === "connected"
                  ? "Account connected"
                  : "Profile only"}
              </Tag>
              {isArchived(coach) && <Tag>Archived</Tag>}
              {canEdit && (
                <Link
                  to={`/coaches/${coach.id}/edit`}
                  className="admin-btn"
                  aria-label={`Edit ${coach.full_name ?? "coach"}`}
                >
                  <Pencil size={14} />
                  Edit
                </Link>
              )}
              {canEdit &&
                (isArchived(coach) ? (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={working}
                    aria-label={`Restore ${coach.full_name ?? "coach"}`}
                    onClick={() => handleRestore(coach)}
                  >
                    <ArchiveRestore size={14} />
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-remove"
                    disabled={working}
                    aria-label={`Archive ${coach.full_name ?? "coach"}`}
                    onClick={() => {
                      setActionError(null);
                      setConfirmingArchive(coach);
                    }}
                  >
                    <Archive size={14} />
                    Archive
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={meta.per_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
