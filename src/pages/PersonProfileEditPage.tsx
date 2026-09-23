import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  api,
  ApiValidationError,
  type PersonIdentity,
  type ProfileOwner,
  type ProfilePerson,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import PersonIdentityList from "../components/people/PersonIdentityList";
import PersonProfileForm, {
  type PersonProfileInitialValues,
  type PersonProfileValues,
  type ProfileKind,
} from "../components/people/PersonProfileForm";
import { personName } from "../utils/training";

interface PersonProfileEditPageProps {
  /** Which catalogue this edit page belongs to. */
  kind: ProfileKind;
}

interface LoadedProfile {
  id: number;
  name: string;
  person: ProfilePerson;
  /** Owner recorded at creation — decides who may flip the visibility. */
  created_by: ProfileOwner | null;
  initialValues: PersonProfileInitialValues;
}

/**
 * Edit a player or a coach: the person's contact details plus the profile's own
 * attributes, on one screen (the two are edited together because they describe
 * the same human).
 *
 * Saving answers with `possible_duplicates` — a correction ("that was Maria, not
 * Ana") is exactly when the club discovers it has recorded someone twice.
 * Nothing is merged automatically; if it turns out the profile belongs to an
 * existing person, that is a merge, not an edit, and the API refuses it.
 *
 * Visibility (`shared`/`private`) is edited here too: the select is locked for
 * everyone but the coach who recorded the profile or an admin, mirroring the
 * API's 403 on an unauthorized flip.
 */
export default function PersonProfileEditPage({
  kind,
}: PersonProfileEditPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const numericId = Number(id);
  const invalidId = !id || Number.isNaN(numericId);

  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [loadError, setLoadError] = useState<string | null>(
    invalidId ? "Not found." : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<PersonIdentity[]>([]);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    const request =
      kind === "player" ? api.player(numericId) : api.coach(numericId);

    request
      .then((record) => {
        if (cancelled) return;
        setLoaded({
          id: record.id,
          name:
            record.full_name?.trim() || personName(record.person, `This ${kind}`),
          person: record.person,
          created_by: record.created_by,
          initialValues: {
            first_name: record.person.first_name,
            last_name: record.person.last_name,
            email: record.person.email,
            phone: record.person.phone,
            preferred_position:
              "preferred_position" in record ? record.preferred_position : null,
            level: "level" in record ? record.level : null,
            coaching_level:
              "coaching_level" in record ? record.coaching_level : null,
            qualifications:
              "qualifications" in record ? record.qualifications : null,
            visibility: record.visibility,
          },
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setLoadError(
          err instanceof Error ? err.message : `Failed to load the ${kind}.`,
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidId, kind, numericId]);

  const handleSubmit = async (values: PersonProfileValues) => {
    if (!loaded) return;
    setErrors([]);
    setSavedName(null);
    setSubmitting(true);
    try {
      // The profile block is keyed per catalogue: the API reads
      // `player_profile`/`coach_profile` and silently ignores the other key, so
      // a shared key would drop every profile edit (visibility included).
      const saved =
        kind === "player"
          ? await api.updatePlayer(loaded.id, {
              person: values.person,
              player_profile: values.profile,
            })
          : await api.updateCoach(loaded.id, {
              person: values.person,
              coach_profile: values.profile,
            });

      setSavedName(
        saved.full_name?.trim() || personName(saved.person, `This ${kind}`),
      );
      setDuplicates(saved.possible_duplicates ?? []);
    } catch (err: unknown) {
      setErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : `Failed to save the ${kind}.`],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (loadError || !loaded)
    return (
      <EmptyState
        title={kind === "player" ? "Player not found" : "Coach not found"}
        description={loadError ?? undefined}
      />
    );

  const backTo =
    kind === "player" ? `/players/${loaded.id}` : `/coaches/${loaded.id}`;

  // Mirrors the API's rule: only the coach who recorded the profile or an
  // admin may flip the visibility — legacy rows without an owner are therefore
  // admin-only. The select is locked rather than offered-and-refused.
  const visibilityEditable = Boolean(
    user?.roles.includes("admin") ||
      (user && loaded.created_by?.id === user.id),
  );

  return (
    <div className="page">
      <PageHeader
        title={`Edit ${loaded.name}`}
        description="Correct the contact details or the profile attributes. Nothing is merged automatically."
      />

      <div className="person-edit-back">
        <button className="back-link" onClick={() => navigate(backTo)}>
          <ArrowLeft size={16} />
          {kind === "player" ? "Back to player" : "Back to coach"}
        </button>
      </div>

      <section className="person-create-panel">
        <PersonProfileForm
          kind={kind}
          initialValues={loaded.initialValues}
          personFieldsLegend="Person"
          visibilityEditable={visibilityEditable}
          submitting={submitting}
          errors={errors}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => navigate(backTo)}
        />
      </section>

      {savedName && (
        <p className="related-item-meta person-saved" role="status">
          {savedName} saved.
        </p>
      )}

      {duplicates.length > 0 && (
        <section className="person-duplicates">
          <h4>Possible duplicates</h4>
          <p className="related-item-meta">
            These people may already describe {savedName ?? loaded.name}.
            Nothing was merged automatically — if this profile belongs to one of
            them, that is a merge, not an edit.
          </p>
          <PersonIdentityList people={duplicates} profileKind={kind} />
        </section>
      )}
    </div>
  );
}
