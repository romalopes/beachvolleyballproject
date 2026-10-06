import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, Eye, EyeOff, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { api, type PaginationMeta, type Player } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/settings/Pagination";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import Tag from "../components/Tag";
import ProfileCreatePanel from "../components/people/ProfileCreatePanel";
import ProfileInviteLinkButton from "../components/people/ProfileInviteLinkButton";
import {
  archivePlayer,
  canManageProfiles,
  deletePlayerProfile,
  isArchived,
  profileDeletionErrorMessage,
  restorePlayer,
} from "../utils/people";

/** Page size for the player catalogue (the API's own default). */
const PER_PAGE = 20;

const playerName = (player: Player) =>
  player.full_name?.trim() || player.display_name || "Unnamed player";

/**
 * Player catalogue: everyone the club can schedule.
 *
 * A player is represented by a PlayerProfile. The list shows account-link state
 * and player-owned attributes. Reading requires
 * a training manager, which is why this page sits behind ManagerRoute.
 */
export default function Players() {
  const { user } = useAuth();
  const canRecord = canManageProfiles(user);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Archived players are a separate view rather than a mixed-in row: the API
  // filters one status at a time, so "show archived" is an explicit mode.
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState<Player | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState<Player | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Soft visibility: by default other coaches' private players are hidden.
  const [showPrivate, setShowPrivate] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const requestParams = (pageNumber: number) => {
    const term = search.trim();
    return {
      ...(term ? { q: term } : {}),
      status: showArchived ? ("archived" as const) : ("active" as const),
      include_private: showPrivate ? true : undefined,
      mine: mineOnly ? true : undefined,
      page: pageNumber,
      per_page: PER_PAGE,
    };
  };

  useEffect(() => {
    let cancelled = false;
    const term = search.trim();
    api
      .players({
        ...(term ? { q: term } : {}),
        status: showArchived ? "archived" : "active",
        include_private: showPrivate ? true : undefined,
        mine: mineOnly ? true : undefined,
        page,
        per_page: PER_PAGE,
      })
      .then((response) => {
        if (cancelled) return;
        setPlayers(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load players.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, showArchived, showPrivate, mineOnly, page]);

  const reload = () => {
    api
      .players(requestParams(page))
      .then((response) => {
        setPlayers(response.data);
        setMeta(response.meta);
      })
      .catch(console.error);
  };

  const handleArchive = async () => {
    if (!confirmingArchive) return;
    setWorking(true);
    setActionError(null);
    try {
      await archivePlayer(confirmingArchive.id);
      setConfirmingArchive(null);
      reload();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async (player: Player) => {
    setWorking(true);
    setActionError(null);
    try {
      await restorePlayer(player.id);
      reload();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmingDelete) return;
    setWorking(true);
    setActionError(null);
    try {
      await deletePlayerProfile(confirmingDelete.id);
      setConfirmingDelete(null);
      reload();
    } catch (err: unknown) {
      setActionError(profileDeletionErrorMessage(err, "Failed to delete the player profile."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Players"
        description="Everyone who can be added to a training session."
      />

      <div className="people-toolbar">
        <label className="person-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search by name or email"
            aria-label="Search players"
            onChange={(event) => {
              setSearch(event.target.value);
              // A new search is a new result set: start from the first page.
              setPage(1);
            }}
          />
        </label>
        {canRecord && (
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={() => setCreating(true)}
          >
            <UserPlus size={14} />
            New player
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
        {showArchived && (
          <span className="related-item-meta">
            Archived players keep their training history — nothing was deleted.
          </span>
        )}
        {canRecord && (
          <>
            <label className="people-filter-toggle">
              <input
                type="checkbox"
                checked={showPrivate}
                onChange={(event) => {
                  setShowPrivate(event.target.checked);
                  setPage(1);
                }}
              />
              <EyeOff size={14} aria-hidden="true" />
              Show private players
            </label>
            <label className="people-filter-toggle">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(event) => {
                  setMineOnly(event.target.checked);
                  setPage(1);
                }}
              />
              <Eye size={14} aria-hidden="true" />
              My players only
            </label>
          </>
        )}
      </div>

      {actionError && !confirmingDelete && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={playerName(confirmingArchive)}
          title={`Archive “${
            playerName(confirmingArchive)
          }”?`}
          warning="The player leaves the catalogue and cannot be added to new trainings. Their training history is kept, and this can be undone."
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

      {confirmingDelete && (
        <DeleteConfirm
          entityName={playerName(confirmingDelete)}
          title={`Permanently delete “${playerName(confirmingDelete)}” profile?`}
          warning="This is only allowed when the profile has no protected history, such as training, tournament, or assessment records. Any linked Account and Person are retained."
          confirmLabel="Delete profile"
          pendingLabel="Deleting..."
          deleting={working}
          error={actionError}
          onCancel={() => setConfirmingDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {creating && (
        <ProfileCreatePanel
          kind="player"
          onCreated={reload}
          onClose={() => setCreating(false)}
        />
      )}

      {error && <div className="admin-error">{error}</div>}

      {loading && players.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : players.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived players" : "No players found"}
          description={
            search.trim()
              ? `No player matches “${search.trim()}”.`
              : showArchived
                ? "Players you archive will be listed here, so they can be restored."
                : "Players recorded by coaches will appear here."
          }
        />
      ) : (
        <ul className="people-list">
          {players.map((player) => (
            <li key={player.id} className="people-row">
              <div className="people-identity">
                <Link to={`/players/${player.id}`} className="people-name">
                  {playerName(player)}
                </Link>
              </div>
              <span className="people-meta">
                {[player.preferred_position, player.level]
                  .filter(Boolean)
                  .join(" · ") || "No player attributes yet"}
              </span>
              <Tag>
                {player.account_status === "connected"
                  ? "Account connected"
                  : "Profile only"}
              </Tag>
              {isArchived(player) && <Tag>Archived</Tag>}
              {player.visibility === "private" && <Tag>Private</Tag>}
              {player.status === "active" && player.account_status !== "connected" &&
                (player.full_name?.trim() || player.display_name?.trim()) && user &&
                (user.roles.includes("admin") ||
                  (user.roles.includes("coach") && player.created_by?.id === user.id)) && (
                  <ProfileInviteLinkButton
                    claimableType="PlayerProfile"
                    claimableId={player.id}
                    profileName={playerName(player)}
                  />
                )}
              {canRecord && (
                <Link
                  to={`/players/${player.id}/edit`}
                  className="admin-btn"
                  aria-label={`Edit ${playerName(player)}`}
                >
                  <Pencil size={14} />
                  Edit
                </Link>
              )}
              {canRecord &&
                (isArchived(player) ? (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={working}
                    aria-label={`Restore ${playerName(player)}`}
                    onClick={() => handleRestore(player)}
                  >
                    <ArchiveRestore size={14} />
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-remove"
                    disabled={working}
                    aria-label={`Archive ${playerName(player)}`}
                    onClick={() => {
                      setActionError(null);
                      setConfirmingArchive(player);
                    }}
                  >
                    <Archive size={14} />
                    Archive
                  </button>
                ))}
              {user?.roles.includes("admin") && (
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  disabled={working}
                  aria-label={`Delete ${playerName(player)} profile`}
                  onClick={() => {
                    setActionError(null);
                    setConfirmingDelete(player);
                  }}
                >
                  <Trash2 size={14} />
                  Delete profile
                </button>
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
          itemsPerPage={meta.per_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
