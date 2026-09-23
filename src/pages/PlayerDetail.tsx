import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";
import { api, type Player } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import {
  archivePlayer,
  canManageProfiles,
  isArchived,
  restorePlayer,
} from "../utils/people";
import { formatTrainingDateRange, participantStatusLabel } from "../utils/training";

/**
 * Player detail: the identity behind the profile, plus the training history.
 *
 * The history comes from the participant rows, so it shows the same status the
 * coach set on the session (invited → confirmed → attended/absent) — one place
 * where attendance is recorded, one place where it is read.
 */
export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canManageProfiles(user);
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(
    invalidId ? "Player not found." : null,
  );
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    api
      .player(numericId)
      .then((loaded) => {
        if (cancelled) return;
        setPlayer(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load player.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, numericId]);

  /** Archive/restore are the same PATCH the edit form uses. */
  const handleArchive = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await archivePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
      setConfirmingArchive(false);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!player) return;
    setWorking(true);
    setActionError(null);
    try {
      const updated = await restorePlayer(player.id);
      setPlayer({ ...player, status: updated.status });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the player.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !player)
    return <EmptyState title="Player not found" description={error ?? undefined} />;

  const history = [...(player.training_session_participants ?? [])].sort(
    (a, b) =>
      (b.training_session?.starts_at ?? "").localeCompare(
        a.training_session?.starts_at ?? "",
      ),
  );

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate("/players")}>
          <ArrowLeft size={16} />
          Back to Players
        </button>
        <span className="section-label">Player</span>
        <h1>{player.full_name ?? player.person.first_name}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag>
            {player.account_status === "connected"
              ? "Account connected"
              : "Profile only"}
          </Tag>
          {player.preferred_position && <Tag>{player.preferred_position}</Tag>}
          {player.level && <Tag>{player.level}</Tag>}
          <Tag>
            {player.training_session_count ?? history.length} training
            {(player.training_session_count ?? history.length) === 1 ? "" : "s"}
          </Tag>
          {player.visibility === "private" && <Tag>Private</Tag>}
          {isArchived(player) && <Tag>Archived</Tag>}
        </div>
        {canEdit && (
          <div className="admin-actions-bar">
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-btn admin-btn-add"
                onClick={() => navigate(`/players/${player.id}/edit`)}
              >
                <Pencil size={14} />
                Edit
              </button>
              {isArchived(player) ? (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={working}
                  onClick={handleRestore}
                >
                  <ArchiveRestore size={14} />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  disabled={working}
                  onClick={() => setConfirmingArchive(true)}
                >
                  <Archive size={14} />
                  Archive
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {actionError && <div className="admin-error">{actionError}</div>}

      {confirmingArchive && (
        <DeleteConfirm
          entityName={player.full_name ?? player.person.first_name}
          title={`Archive “${
            player.full_name ?? player.person.first_name
          }”?`}
          warning="The player leaves the catalogue and cannot be added to new trainings. Their training history is kept, and this can be undone."
          confirmLabel="Archive"
          pendingLabel="Archiving..."
          deleting={working}
          error={actionError}
          onCancel={() => {
            setConfirmingArchive(false);
            setActionError(null);
          }}
          onConfirm={handleArchive}
        />
      )}

      <section className="detail-section">
        <h2>Identity</h2>
        <p>
          {player.person.first_name} {player.person.last_name ?? ""}
          <br />
          {player.person.email ?? "No email"} · {player.person.phone ?? "No phone"}
        </p>
        <p className="related-item-meta">
          Recorded as {player.person.creation_source === "coach_created"
            ? "a profile entered by a coach"
            : player.person.creation_source}
          {player.person.date_of_birth ? ` · born ${player.person.date_of_birth}` : ""}
        </p>
      </section>

      <section className="detail-section">
        <h2>Training history</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No trainings yet"
            description="This player has not been added to a training session."
          />
        ) : (
          <ul className="people-list">
            {history.map((row) => (
              <li key={row.id} className="people-row">
                <div className="people-identity">
                  {row.training_session ? (
                    <Link
                      to={`/training/${row.training_session.id}`}
                      className="people-name"
                    >
                      {row.training_session.title}
                    </Link>
                  ) : (
                    <span className="people-name">Training session</span>
                  )}
                  <span className="people-contact">
                    {row.training_session
                      ? formatTrainingDateRange(
                          row.training_session.starts_at,
                          row.training_session.ends_at,
                        )
                      : ""}
                  </span>
                </div>
                <Tag>{participantStatusLabel(row.status)}</Tag>
                {row.notes && <span className="people-meta">{row.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
