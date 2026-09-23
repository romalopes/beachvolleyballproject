import { useState } from "react";
import { UserPlus } from "lucide-react";

export type ProfileKind = "player" | "coach";

/** What the form reports back: the person's contact fields and the profile's own. */
export interface PersonProfileValues {
  person: {
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  profile: {
    preferred_position?: string | null;
    level?: string | null;
    coaching_level?: string | null;
    qualifications?: string | null;
  };
}

export interface PersonProfileInitialValues {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_position?: string | null;
  level?: string | null;
  coaching_level?: string | null;
  qualifications?: string | null;
}

interface PersonProfileFormProps {
  kind: ProfileKind;
  initialValues?: PersonProfileInitialValues;
  /**
   * True when an existing person was chosen: the contact fields are hidden
   * because those details already belong to that identity.
   */
  hidePersonFields?: boolean;
  personFieldsLegend?: string;
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
  hidePersonFields = false,
  personFieldsLegend = "New person (no account)",
  submitting = false,
  errors = [],
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: PersonProfileFormProps) {
  const [firstName, setFirstName] = useState(blank(initialValues?.first_name));
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
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hidePersonFields && !firstName.trim()) {
      setLocalErrors(["A first name is required."]);
      return;
    }
    setLocalErrors([]);

    onSubmit({
      person: {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      },
      profile:
        kind === "player"
          ? {
              preferred_position: position.trim() || null,
              level: level.trim() || null,
            }
          : {
              coaching_level: coachingLevel.trim() || null,
              qualifications: qualifications.trim() || null,
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

      {!hidePersonFields && (
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
