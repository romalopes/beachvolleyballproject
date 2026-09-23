import type { PersonIdentity } from "../../api";
import Tag from "../Tag";

interface PersonIdentityListProps {
  people: PersonIdentity[];
  /**
   * Renders a pick button per row. The duplicate suggestions returned by the
   * API are the same shape as a search result, so one component serves both.
   */
  onSelect?: (person: PersonIdentity) => void;
  /** Set when the given profile kind already exists on the person. */
  profileKind?: "player" | "coach";
  emptyLabel?: string;
}

/**
 * One row per person: name, contact, whether they have an account, and whether
 * a profile of the kind being created already exists. Identity decisions are
 * made here — this is the moment a coach chooses "that is them" instead of
 * recording a duplicate.
 */
export default function PersonIdentityList({
  people,
  onSelect,
  profileKind,
  emptyLabel = "No matching person.",
}: PersonIdentityListProps) {
  if (people.length === 0) {
    return <p className="related-item-meta">{emptyLabel}</p>;
  }

  const existingProfileId = (person: PersonIdentity) =>
    profileKind === "coach" ? person.coach_profile_id : person.player_profile_id;

  return (
    <ul className="person-identity-list">
      {people.map((person) => {
        const profileId = existingProfileId(person);
        return (
          <li key={person.id} className="person-identity-row">
            <div className="person-identity-main">
              <span className="person-identity-name">{person.full_name}</span>
              <span className="person-identity-contact">
                {[person.email, person.phone].filter(Boolean).join(" · ") ||
                  "No contact details"}
              </span>
              {(person.aliases?.length ?? 0) > 0 && (
                <span className="person-identity-alias">
                  also known as {person.aliases!.join(", ")}
                </span>
              )}
            </div>
            <Tag>
              {person.account_status === "connected"
                ? "Account connected"
                : "Profile only"}
            </Tag>
            {profileId != null && profileKind && (
              <Tag>Already a {profileKind}</Tag>
            )}
            {onSelect && (
              <button
                type="button"
                className="admin-btn"
                disabled={profileId != null}
                onClick={() => onSelect(person)}
              >
                Use this person
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
