import { useState } from "react";
import { UserPlus, Plus, Trash2 } from "lucide-react";
import type {
  ProfileVisibility,
  OrganisationMembership,
  OrganisationMembershipInput,
  Organisation,
} from "../../api";

export type ProfileKind = "player" | "coach";

/**
 * How the identity is supplied.
 *
 *   * "person"     — record a new Person and link the profile to it. The
 *                    normal case: the club learns a human and their details.
 *   * "placeholder"— record a PlayerProfile that has *no* Person yet. The
 *                    backend supports this (`PlayerProfile` requires
 *                    `display_name` precisely when `person.nil?`), and it is
 *                    the only state a claim invitation can exist in.
 */
export type IdentityMode = "person" | "placeholder";

/** What the form reports back: the person's contact fields and the profile's own. */
export interface PersonProfileValues {
  /**
   * Null in `placeholder` mode — the profile is recorded without a Person so
   * the player can claim it later through an invitation.
   */
  person: {
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    organisation_memberships_attributes?: OrganisationMembershipInput[];
  } | null;
  profile: {
    /** Required in `placeholder` mode; unused when a Person is recorded. */
    display_name?: string;
    preferred_position?: string | null;
    level?: string | null;
    coaching_level?: string | null;
    qualifications?: string | null;
    visibility: ProfileVisibility;
  };
}

export interface PersonProfileInitialValues {
  first_name?: string | null;
  last_name?: string | null;
  /** Only set when editing a profile recorded without a Person. */
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_position?: string | null;
  level?: string | null;
  coaching_level?: string | null;
  qualifications?: string | null;
  visibility?: ProfileVisibility | null;
  /** Existing organisation memberships (when editing). */
  organisation_memberships?: OrganisationMembership[];
}

interface PersonProfileFormProps {
  kind: ProfileKind;
  initialValues?: PersonProfileInitialValues;
  /**
   * "placeholder" records a profile with no Person. Only meaningful for
   * players — a CoachProfile requires a Person (see Phase 2), so the caller
   * must not offer it for coaches.
   */
  identityMode?: IdentityMode;
  /** List of organisations to choose from for memberships. */
  organisations?: Organisation[];
  /**
   * True when an existing person was chosen: the contact fields are hidden
   * because those details already belong to that identity.
   */
  hidePersonFields?: boolean;
  personFieldsLegend?: string;
  /**
   * False when the signed-in user is neither the profile's owner nor an admin:
   * the API answers 403 on such a flip, so the control is locked rather than
   * offered and refused.
   */
  visibilityEditable?: boolean;
  submitting?: boolean;
  /** Errors from the API, rendered under the fields. */
  errors?: string[];
  submitLabel: string;
  onSubmit: (values: PersonProfileValues) => void;
  onCancel: () => void;
  /** Rendered above the fields, inside the form (e.g. the identity search). */
  children?: React.ReactNode;
}

const blank = (value: string | null | undefined) => value ?? "";

/**
 * The person + profile fields, shared by "record a player/coach" and "edit a
 * player/coach" so the two can never drift apart.
 *
 * It renders a complete `<form>`: callers pass whatever must sit above the
 * fields (the identity search) as children, and own the submit.
 */
export default function PersonProfileForm({
  kind,
  initialValues,
  identityMode = "person",
  organisations = [],
  hidePersonFields = false,
  personFieldsLegend = "New person (no account)",
  visibilityEditable = true,
  submitting = false,
  errors = [],
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: PersonProfileFormProps) {
  const [firstName, setFirstName] = useState(blank(initialValues?.first_name));
  const [displayName, setDisplayName] = useState(blank(initialValues?.display_name));
  const [lastName, setLastName] = useState(blank(initialValues?.last_name));
  const [email, setEmail] = useState(blank(initialValues?.email));
  const [phone, setPhone] = useState(blank(initialValues?.phone));
  const [position, setPosition] = useState(
    blank(initialValues?.preferred_position),
  );
  const [level, setLevel] = useState(blank(initialValues?.level));
  const [coachingLevel, setCoachingLevel] = useState(
    blank(initialValues?.coaching_level),
  );
  const [qualifications, setQualifications] = useState(
    blank(initialValues?.qualifications),
  );
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    initialValues?.visibility ?? "shared",
  );

  // Organisation memberships form state
  const [memberships, setMemberships] = useState<
    (OrganisationMembershipInput & { _destroy?: boolean })[]
  >(() => {
    if (initialValues?.organisation_memberships?.length) {
      return initialValues.organisation_memberships.map((m) => ({
        id: m.id,
        organisation_id: m.organisation_id,
        role: m.role,
        status: m.status,
      }));
    }
    return [];
  });
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Membership helpers
  const addMembership = () => {
    setMemberships((prev) => [
      ...prev,
      {
        organisation_id: organisations[0]?.id ?? 0,
        role: "member",
        status: "pending",
      },
    ]);
  };

  const removeMembership = (index: number) => {
    setMemberships((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item.id && item.status === "pending") {
        // Pending invitations have not become membership history, so they can
        // be withdrawn and deleted. All other saved rows are retained.
        next[index] = { ...item, _destroy: true };
      } else if (item.id) {
        // Active or suspended members leave the roster by ending the membership;
        // the server stamps left_at and retains the historical row.
        next[index] = { ...item, status: "ended" };
      } else {
        next.splice(index, 1);
      }
      return next;
    });
  };

  const updateMembership = (
    index: number,
    field: "organisation_id" | "role" | "status",
    value: number | string,
  ) => {
    setMemberships((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const isPlaceholder = identityMode === "placeholder";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Placeholder mode validates the display name instead of the person, and
    // reports a null person so the caller omits `person` from the payload.
    if (isPlaceholder && !displayName.trim()) {
      setLocalErrors(["A display name is required."]);
      return;
    }
    if (!isPlaceholder && !hidePersonFields && !firstName.trim()) {
      setLocalErrors(["A first name is required."]);
      return;
    }
    setLocalErrors([]);

    const membershipAttrs = memberships.map((m) => ({
      id: m.id,
      organisation_id: m.organisation_id,
      role: m.role,
      status: m.status,
      _destroy: m._destroy,
    }));

    onSubmit({
      person: isPlaceholder
        ? null
        : {
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            organisation_memberships_attributes: membershipAttrs,
          },
      profile:
        kind === "player"
          ? {
              display_name: isPlaceholder ? displayName.trim() : undefined,
              preferred_position: position.trim() || null,
              level: level.trim() || null,
              visibility,
            }
          : {
              coaching_level: coachingLevel.trim() || null,
              qualifications: qualifications.trim() || null,
              visibility,
            },
    });
  };

  const messages = [...localErrors, ...errors];

  return (
    <form
      className="admin-form person-profile-form"
      aria-label={kind === "player" ? "Player details" : "Coach details"}
      onSubmit={handleSubmit}
    >
      {children}

      {isPlaceholder && (
        <fieldset className="person-new-fields">
          <legend>
            <UserPlus size={14} aria-hidden="true" /> Player without an
            account
          </legend>
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <span className="related-item-meta">
            No account is created and no contact details are stored. The player
            can later claim this profile with a one-time invitation link.
          </span>
        </fieldset>
      )}

      {!isPlaceholder && !hidePersonFields && (
        <fieldset className="person-new-fields">
          <legend>
            <UserPlus size={14} aria-hidden="true" /> {personFieldsLegend}
          </legend>
          <label>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
        </fieldset>
      )}

      <fieldset className="person-profile-fields">
        <legend>{kind === "player" ? "Player profile" : "Coach profile"}</legend>
        {kind === "player" ? (
          <>
            <label>
              Preferred position
              <input
                type="text"
                value={position}
                placeholder="e.g. blocker"
                onChange={(event) => setPosition(event.target.value)}
              />
            </label>
            <label>
              Level
              <input
                type="text"
                value={level}
                placeholder="e.g. intermediate"
                onChange={(event) => setLevel(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Coaching level
              <input
                type="text"
                value={coachingLevel}
                placeholder="e.g. state"
                onChange={(event) => setCoachingLevel(event.target.value)}
              />
            </label>
            <label>
              Qualifications
              <input
                type="text"
                value={qualifications}
                placeholder="e.g. Level 1"
                onChange={(event) => setQualifications(event.target.value)}
              />
            </label>
          </>
        )}
      </fieldset>

      <div className="profile-visibility-field">
        <label>
          Visibility
          <select
            value={visibility}
            disabled={!visibilityEditable || submitting}
            onChange={(event) =>
              setVisibility(event.target.value as ProfileVisibility)
            }
          >
            <option value="shared">Shared</option>
            <option value="private">Private</option>
          </select>
        </label>
        <span className="related-item-meta">
          {visibility === "shared"
            ? "Shared profiles are visible to every training manager."
            : "Private profiles are hidden from other coaches' lists and detail pages; curators and admins still see everything."}
        </span>
        {!visibilityEditable && (
          <span className="related-item-meta">
            Only the coach who recorded this profile (or an admin) can change
            visibility.
          </span>
        )}
      </div>

      {/* Memberships belong to the Person; a placeholder profile has none. */}
      {!isPlaceholder && organisations.length > 0 && (
        <fieldset className="person-memberships-field">
          <legend>Organisation memberships</legend>
          <p className="related-item-meta">
            Ending a membership removes it from the current roster and keeps its history. Pending invitations can be withdrawn.
          </p>
          {memberships.map((m, idx) => m._destroy ? null : (
            <div key={idx} className="membership-row" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <select
                value={m.organisation_id ? String(m.organisation_id) : ""}
                onChange={(e) => updateMembership(idx, "organisation_id", Number(e.target.value) || 0)}
                disabled={submitting}
                style={{ flex: 2 }}
              >
                <option value="">— Select organisation —</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <select
                value={m.role}
                onChange={(e) => updateMembership(idx, "role", e.target.value)}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                <option value="member">Member</option>
                <option value="coach">Coach</option>
                <option value="administrator">Administrator</option>
                <option value="owner">Owner</option>
              </select>
              <select
                value={m.status}
                onChange={(e) => updateMembership(idx, "status", e.target.value)}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="ended">Ended</option>
              </select>
              {m.status !== "ended" && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => removeMembership(idx)}
                  disabled={submitting}
                  aria-label={m.id && m.status !== "pending" ? "End membership" : m.id ? "Withdraw invitation" : "Remove membership"}
                >
                  <Trash2 size={14} />
                  {m.id && m.status !== "pending" ? "End" : m.id ? "Withdraw" : "Remove"}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={addMembership}
            disabled={submitting}
          >
            <Plus size={14} /> Add membership
          </button>
        </fieldset>
      )}

      {messages.length > 0 && (
        <div className="admin-error">
          <ul>
            {messages.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-form-actions">
        <button
          type="submit"
          className="admin-btn admin-btn-add"
          disabled={submitting}
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
