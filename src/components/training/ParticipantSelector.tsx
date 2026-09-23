import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { ParticipantStatus, Player } from "../../api";
import { PARTICIPANT_STATUSES, personName } from "../../utils/training";
import { moveFocus } from "./focusDraft";
import {
  includesPlayer,
  participantFromPerson,
  participantFromPlayer,
  playerSubtitle,
  type ParticipantDraft,
} from "./participantDraft";

interface ParticipantSelectorProps {
  /** The players catalogue, loaded by the form. */
  players: Player[];
  selected: ParticipantDraft[];
  onChange: (participants: ParticipantDraft[]) => void;
}

const emptyNewPerson = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

/**
 * Roster editor for a training session.
 *
 * Two ways to add a player, matching the API:
 *   * pick someone from the players catalogue (a `player_profile_id`);
 *   * record a player who has no account yet — the person is submitted inline
 *     and the server creates Person + PlayerProfile without an Account, so a
 *     coach can schedule someone who has not signed up.
 *
 * A player can only appear once (the database enforces it as well), so chosen
 * players leave the candidate list.
 */
export default function ParticipantSelector({
  players,
  selected,
  onChange,
}: ParticipantSelectorProps) {
  const [search, setSearch] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newPerson, setNewPerson] = useState(emptyNewPerson);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => players.filter((player) => !includesPlayer(selected, player.id)),
    [players, selected],
  );

  const term = search.trim().toLowerCase();
  const visibleCandidates = term
    ? candidates.filter((player) =>
        `${player.full_name ?? personName(player.person)} ${player.person?.email ?? ""}`
          .toLowerCase()
          .includes(term),
      )
    : candidates;

  const updateRow = (key: string, patch: Partial<ParticipantDraft>) =>
    onChange(
      selected.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const handleAddPlayer = (player: Player) => {
    setError(null);
    onChange([...selected, participantFromPlayer(player)]);
    setSearch("");
  };

  const handleAddNewPerson = () => {
    if (!newPerson.first_name.trim()) {
      setError("A first name is required to record a new player.");
      return;
    }
    setError(null);
    onChange([
      ...selected,
      participantFromPerson({
        first_name: newPerson.first_name.trim(),
        last_name: newPerson.last_name.trim() || null,
        email: newPerson.email.trim() || null,
        phone: newPerson.phone.trim() || null,
      }),
    ]);
    setNewPerson(emptyNewPerson);
    setAddingNew(false);
  };

  return (
    <div className="training-editor-section" role="group" aria-label="Players">
      <h3>Players</h3>
      <p className="related-item-meta">
        Who is training? Add players from the catalogue, or record someone who
        has not signed up yet.
      </p>

      <label className="training-participant-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search players by name or email"
          aria-label="Search players"
        />
      </label>

      {visibleCandidates.length === 0 ? (
        <p className="related-item-meta">No players match the search.</p>
      ) : (
        <ul className="training-participant-candidates">
          {visibleCandidates.map((player) => {
            const subtitle = playerSubtitle(player);
            const name = player.full_name ?? personName(player.person);
            return (
              <li key={player.id} className="training-participant-candidate">
                <span className="training-participant-candidate-name">
                  {name}
                </span>
                {subtitle && (
                  <span className="related-item-meta"> · {subtitle}</span>
                )}
                {player.account_status === "profile_only" && (
                  <span className="training-participant-flag">No account</span>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn-add"
                  aria-label={`Add ${name} to the session`}
                  onClick={() => handleAddPlayer(player)}
                >
                  <Plus size={14} />
                  Add
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {addingNew ? (
        <div className="training-participant-new">
          <h4>Record a new player</h4>
          <div className="training-participant-new-fields">
            <label>
              First name
              <input
                type="text"
                value={newPerson.first_name}
                onChange={(event) =>
                  setNewPerson({ ...newPerson, first_name: event.target.value })
                }
              />
            </label>
            <label>
              Last name
              <input
                type="text"
                value={newPerson.last_name}
                onChange={(event) =>
                  setNewPerson({ ...newPerson, last_name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={newPerson.email}
                onChange={(event) =>
                  setNewPerson({ ...newPerson, email: event.target.value })
                }
              />
            </label>
            <label>
              Phone
              <input
                type="text"
                value={newPerson.phone}
                onChange={(event) =>
                  setNewPerson({ ...newPerson, phone: event.target.value })
                }
              />
            </label>
          </div>
          <p className="related-item-meta">
            No account or password is created — the player is recorded so they
            can be scheduled, and can claim this profile later.
          </p>
          <div className="training-editor-row-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={handleAddNewPerson}
            >
              Add player
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setAddingNew(false);
                setNewPerson(emptyNewPerson);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="admin-btn"
          onClick={() => setAddingNew(true)}
        >
          <UserPlus size={14} />
          Record a new player
        </button>
      )}

      {error && <div className="admin-error">{error}</div>}

      {selected.length === 0 ? (
        <p className="related-item-meta">
          No players added yet. Add one from the list above.
        </p>
      ) : (
        <ul className="training-participant-list">
          {selected.map((row, index) => (
            <li key={row.key} className="training-participant-row">
              <span className="training-participant-title">
                {index + 1}. {row.name}
                {row.subtitle && (
                  <span className="related-item-meta"> · {row.subtitle}</span>
                )}
              </span>
              <label className="training-participant-field">
                Status
                <select
                  value={row.status ?? "invited"}
                  aria-label={`Participant ${index + 1} status`}
                  onChange={(event) =>
                    updateRow(row.key, {
                      status: event.target.value as ParticipantStatus,
                    })
                  }
                >
                  {PARTICIPANT_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="training-participant-field">
                Session notes
                <textarea
                  value={row.notes ?? ""}
                  rows={2}
                  aria-label={`Participant ${index + 1} notes`}
                  placeholder="Injury, pairing, equipment..."
                  onChange={(event) =>
                    updateRow(row.key, { notes: event.target.value })
                  }
                />
              </label>
              <div className="training-editor-row-actions">
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move participant ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => onChange(moveFocus(selected, index, -1))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  aria-label={`Move participant ${index + 1} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => onChange(moveFocus(selected, index, 1))}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-remove"
                  aria-label={`Remove participant ${index + 1}`}
                  onClick={() =>
                    onChange(
                      selected.filter((candidate) => candidate.key !== row.key),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
