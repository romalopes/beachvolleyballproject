import { useState } from "react";
import { UserPlus } from "lucide-react";
import type { ProfileVisibility } from "../../api";

export type ProfileKind = "player" | "coach";

export interface ProfileFormValues {
  profile: {
    display_name: string;
    email?: string | null;
    preferred_position?: string | null;
    level?: string | null;
    coaching_level?: string | null;
    qualifications?: string | null;
    visibility: ProfileVisibility;
  };
}

export interface ProfileInitialValues {
  display_name?: string | null;
  email?: string | null;
  preferred_position?: string | null;
  level?: string | null;
  coaching_level?: string | null;
  qualifications?: string | null;
  visibility?: ProfileVisibility | null;
}

interface Props {
  kind: ProfileKind;
  initialValues?: ProfileInitialValues;
  visibilityEditable?: boolean;
  submitting?: boolean;
  errors?: string[];
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

const blank = (value: string | null | undefined) => value ?? "";

/** Profile-owned fields only; this form cannot create or update an identity. */
export default function ProfileDetailsForm({
  kind,
  initialValues,
  visibilityEditable = true,
  submitting = false,
  errors = [],
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: Props) {
  const [displayName, setDisplayName] = useState(blank(initialValues?.display_name));
  const [email, setEmail] = useState(blank(initialValues?.email));
  const [position, setPosition] = useState(blank(initialValues?.preferred_position));
  const [level, setLevel] = useState(blank(initialValues?.level));
  const [coachingLevel, setCoachingLevel] = useState(blank(initialValues?.coaching_level));
  const [qualifications, setQualifications] = useState(blank(initialValues?.qualifications));
  const [visibility, setVisibility] = useState<ProfileVisibility>(initialValues?.visibility ?? "shared");
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setLocalErrors(["A display name is required."]);
      return;
    }
    setLocalErrors([]);
    onSubmit({
      profile: kind === "player"
        ? { display_name: displayName.trim(), email: email.trim() || null, preferred_position: position.trim() || null, level: level.trim() || null, visibility }
        : { display_name: displayName.trim(), email: email.trim() || null, coaching_level: coachingLevel.trim() || null, qualifications: qualifications.trim() || null, visibility },
    });
  };

  return <form className="admin-form person-profile-form" aria-label={kind === "player" ? "Player details" : "Coach details"} onSubmit={submit}>
    {children}
    <fieldset className="person-new-fields">
      <legend><UserPlus size={14} aria-hidden="true" /> {kind === "player" ? "Player" : "Coach"} profile identity</legend>
      <label>Display name<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <span className="related-item-meta">Profile information is stored separately from account and contact details. An account can be linked later through an invitation and claim.</span>
    </fieldset>
    <fieldset className="person-profile-fields">
      <legend>{kind === "player" ? "Player profile" : "Coach profile"}</legend>
      {kind === "player" ? <>
        <label>Preferred position<input type="text" value={position} placeholder="e.g. blocker" onChange={(event) => setPosition(event.target.value)} /></label>
        <label>Level<input type="text" value={level} placeholder="e.g. intermediate" onChange={(event) => setLevel(event.target.value)} /></label>
      </> : <>
        <label>Coaching level<input type="text" value={coachingLevel} placeholder="e.g. state" onChange={(event) => setCoachingLevel(event.target.value)} /></label>
        <label>Qualifications<input type="text" value={qualifications} placeholder="e.g. Level 1" onChange={(event) => setQualifications(event.target.value)} /></label>
      </>}
    </fieldset>
    <div className="profile-visibility-field">
      <label>Visibility<select value={visibility} disabled={!visibilityEditable || submitting} onChange={(event) => setVisibility(event.target.value as ProfileVisibility)}><option value="shared">Shared</option><option value="private">Private</option></select></label>
      <span className="related-item-meta">{visibility === "shared" ? "Shared profiles are visible to every training manager." : "Private profiles are hidden from other coaches' lists and detail pages; curators and admins still see everything."}</span>
      {!visibilityEditable && <span className="related-item-meta">Only the coach who recorded this profile (or an admin) can change visibility.</span>}
    </div>
    {[...localErrors, ...errors].length > 0 && <div className="admin-error"><ul>{[...localErrors, ...errors].map((error, index) => <li key={`${index}:${error}`}>{error}</li>)}</ul></div>}
    <div className="admin-form-actions"><button type="submit" className="admin-btn admin-btn-add" disabled={submitting}>{submitting ? "Saving..." : submitLabel}</button><button type="button" className="admin-btn" onClick={onCancel} disabled={submitting}>Cancel</button></div>
  </form>;
}
