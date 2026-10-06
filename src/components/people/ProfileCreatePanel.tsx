import { useState } from "react";
import { api, ApiValidationError } from "../../api";
import ProfileDetailsForm, {
  type ProfileFormValues,
  type ProfileKind,
} from "./ProfileDetailsForm";

interface ProfileCreatePanelProps {
  kind: ProfileKind;
  onCreated: (createdName: string) => void;
  onClose: () => void;
}

/** Records profile details without creating or editing a Person or Account. */
export default function ProfileCreatePanel({
  kind,
  onCreated,
  onClose,
}: ProfileCreatePanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const handleSubmit = async (values: ProfileFormValues) => {
    setErrors([]);
    setSubmitting(true);
    try {
      const result = kind === "player"
        ? await api.createPlayer({ player_profile: values.profile })
        : await api.createCoach({ coach_profile: values.profile });
      const name = result.full_name?.trim() ||
        ("display_name" in result ? result.display_name?.trim() : null) ||
        `New ${kind}`;
      setCreatedName(name);
      onCreated(name);
    } catch (err: unknown) {
      setErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : `Failed to save the ${kind} profile.`],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdName) {
    return (
      <section className="admin-form person-create-panel" aria-label={`Record a ${kind}`}>
        <h3>{createdName} is now a {kind} profile</h3>
        <p className="related-item-meta">Profile created. An account can be linked later through an invitation and claim.</p>
        <div className="admin-form-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={onClose}>Done</button>
        </div>
      </section>
    );
  }

  return (
    <section className="person-create-panel">
      <ProfileDetailsForm
        kind={kind}
        submitting={submitting}
        errors={errors}
        submitLabel={`Add ${kind}`}
        onSubmit={handleSubmit}
        onCancel={onClose}
      >
        <h3>Record a {kind} profile</h3>
      </ProfileDetailsForm>
    </section>
  );
}
