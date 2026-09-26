import { useMemo, useState } from "react";
import { Plus, Search, Trash2, UserPlus, AlertCircle } from "lucide-react";
import type {
  AssessmentSessionParticipant,
  AssessmentSessionPlayerInput,
  Player,
} from "../../api";
import { personName } from "../../utils/training";
import { playerSubtitle } from "../training/participantDraft";

interface AssessmentSessionRosterProps {
  participants: AssessmentSessionParticipant[];
  availablePlayers: Player[];
  isDraft: boolean;
  onAddPlayers: (players: AssessmentSessionPlayerInput[]) => Promise<void>;
  onRemovePlayers: (playerProfileIds: number[]) => Promise<void>;
}

const emptyNewPerson = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

export default function AssessmentSessionRoster({
  participants,
  availablePlayers,
  isDraft,
  onAddPlayers,
  onRemovePlayers,
}: AssessmentSessionRosterProps) {
  const [search, setSearch] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newPerson, setNewPerson] = useState(emptyNewPerson);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const existingIds = new Set(participants.map((p) => p.player_profile_id));
    return availablePlayers.filter((player) => !existingIds.has(player.id));
  }, [availablePlayers, participants]);

  const term = search.trim().toLowerCase();
  const visibleCandidates = term
    ? candidates.filter((player) =>
        `${player.full_name ?? personName(player.person)} ${player.person?.email ?? ""}`
          .toLowerCase()
          .includes(term),
      )
    : candidates;

  const handleAddPlayer = async (player: Player) => {
    setError(null);
    setWorking(true);
    try {
      await onAddPlayers([{ player_profile_id: player.id, inclusion: "included" }]);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player.");
    } finally {
      setWorking(false);
    }
  };

  const handleAddNewPerson = async () => {
    if (!newPerson.first_name.trim()) {
      setError("A first name is required to record a new player.");
      return;
    }
    setError(null);
    setWorking(true);
    try {
      await onAddPlayers([
        {
          person: {
            first_name: newPerson.first_name.trim(),
            last_name: newPerson.last_name.trim() || null,
            email: newPerson.email.trim() || null,
            phone: newPerson.phone.trim() || null,
          },
          inclusion: "included",
        },
      ]);
      setNewPerson(emptyNewPerson);
      setAddingNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create and add player.");
    } finally {
      setWorking(false);
    }
  };
  const handleRemove = async (playerProfileId: number) => {
    setError(null);
    setWorking(true);
    try {
      await onRemovePlayers([playerProfileId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove player.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="session-roster-section">
      <div className="section-header">
        <h3>Session Roster ({participants.length})</h3>
        <p className="related-item-meta">
          {isDraft
            ? "Manage the roster of players observed in this session. Add existing players or create a new player."
            : "Roster is finalized because this session is published."}
        </p>
      </div>

      {isDraft && (
        <div className="session-roster-controls">
          <label className="training-participant-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available players to add..."
              aria-label="Search available players"
              disabled={working}
            />
          </label>

          {search.trim() && (
            <div className="session-candidate-dropdown">
              {visibleCandidates.length === 0 ? (
                <div className="candidate-empty">No matching players found.</div>
              ) : (
                <ul className="candidate-list">
                  {visibleCandidates.slice(0, 10).map((player) => (
                    <li key={player.id} className="candidate-item">
                      <div>
                        <strong>{player.full_name ?? personName(player.person)}</strong>
                        {playerSubtitle(player) && (
                          <span className="related-item-meta"> · {playerSubtitle(player)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="admin-btn admin-btn-add"
                        onClick={() => void handleAddPlayer(player)}
                        disabled={working}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {addingNew ? (
            <div className="session-new-person-form" role="region" aria-label="Create player inline">
              <h4>Record a new player</h4>
              <div className="form-row">
                <label>
                  First name *
                  <input
                    type="text"
                    value={newPerson.first_name}
                    onChange={(e) => setNewPerson({ ...newPerson, first_name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={newPerson.last_name}
                    onChange={(e) => setNewPerson({ ...newPerson, last_name: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Email
                  <input
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-add"
                  onClick={() => void handleAddNewPerson()}
                  disabled={working}
                >
                  Create &amp; Add Player
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => {
                    setAddingNew(false);
                    setNewPerson(emptyNewPerson);
                    setError(null);
                  }}
                  disabled={working}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="admin-btn session-btn-inline-person"
              onClick={() => setAddingNew(true)}
              disabled={working}
            >
              <UserPlus size={14} />
              Record a new player
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="empty-roster-msg">No players on the roster yet. Add players above to score them.</p>
      ) : (
        <ul className="session-roster-list">
          {participants.map((participant, index) => (
            <li key={participant.id} className="session-roster-item">
              <span className="roster-item-index">{index + 1}.</span>
              <div className="roster-item-info">
                <span className="roster-player-name">{participant.player_name}</span>
                {participant.inclusion === "excluded" && (
                  <span className="roster-badge excluded">
                    Excluded{participant.missing_reason ? `: ${participant.missing_reason}` : ""}
                  </span>
                )}
                {participant.result && participant.result.overall_score != null && (
                  <span className="roster-badge score">Score: {participant.result.overall_score}</span>
                )}
                {participant.result && participant.result.status === "incomplete" && (
                  <span className="roster-badge incomplete">
                    Missing {participant.result.missing_category_ids.length} category
                    {participant.result.missing_category_ids.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {isDraft && (
                <div className="roster-item-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-remove"
                    title={`Remove ${participant.player_name} from session`}
                    aria-label={`Remove ${participant.player_name}`}
                    onClick={() => void handleRemove(participant.player_profile_id)}
                    disabled={working}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

