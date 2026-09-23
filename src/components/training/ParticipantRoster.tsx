import type {
  ParticipantStatus,
  TrainingSessionParticipant,
} from "../../api";
import {
  accountConnectionLabel,
  PARTICIPANT_STATUSES,
  participantName,
  participantStatusLabel,
  participantSummary,
} from "../../utils/training";
import EmptyState from "../EmptyState";
import Tag from "../Tag";

interface ParticipantRosterProps {
  participants?: TrainingSessionParticipant[];
  /**
   * When provided the roster becomes editable — this is how a coach records
   * attendance after the session ("attended" / "absent"). Players see the same
   * list read-only.
   */
  onStatusChange?: (participantId: number, status: ParticipantStatus) => void;
  /** Participant whose status is currently being saved. */
  savingId?: number | null;
}

/**
 * Read-only (for players) or editable (for coaches) roster of a training
 * session. Attendance is part of the same participant row, so marking it is an
 * update of the session itself — the backend keeps one truth for "who was
 * invited" and "who actually came".
 */
export default function ParticipantRoster({
  participants,
  onStatusChange,
  savingId,
}: ParticipantRosterProps) {
  const rows = participants ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No players yet"
        description="Players will appear here once they are added to the training."
      />
    );
  }

  return (
    <>
      <p className="related-item-meta participant-summary">
        {participantSummary(rows)}
      </p>
      <ul className="participant-list">
        {rows.map((participant, index) => {
          const connection = accountConnectionLabel(
            participant.account_connected,
          );
          return (
            <li key={participant.id} className="participant-row">
              <div className="participant-identity">
                <span className="participant-name">
                  {index + 1}. {participantName(participant)}
                </span>
                {connection && (
                  <span className="related-item-meta"> · {connection}</span>
                )}
                {participant.notes && (
                  <p className="participant-notes">{participant.notes}</p>
                )}
              </div>
              {onStatusChange ? (
                <label className="participant-status">
                  Status
                  <select
                    value={participant.status}
                    aria-label={`Status of ${participantName(participant)}`}
                    disabled={savingId === participant.id}
                    onChange={(event) =>
                      onStatusChange(
                        participant.id,
                        event.target.value as ParticipantStatus,
                      )
                    }
                  >
                    {PARTICIPANT_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Tag>{participantStatusLabel(participant.status)}</Tag>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
