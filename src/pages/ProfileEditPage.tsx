import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiValidationError, type ProfileOwner } from "../api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import ProfileDetailsForm, { type ProfileFormValues, type ProfileKind } from "../components/people/ProfileDetailsForm";

interface Props { kind: ProfileKind }
interface LoadedProfile {
  id: number;
  name: string;
  created_by: ProfileOwner | null;
  initialValues: {
    display_name: string;
    email?: string | null;
    preferred_position?: string | null;
    level?: string | null;
    coaching_level?: string | null;
    qualifications?: string | null;
    visibility: "shared" | "private";
  };
}

/** Edit volleyball profile details without editing legacy Person/contact data. */
export default function ProfileEditPage({ kind }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const numericId = Number(id);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(!id || Number.isNaN(numericId) ? "Not found." : null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(numericId)) return;
    let cancelled = false;
    (kind === "player" ? api.player(numericId) : api.coach(numericId))
      .then((record) => {
        if (cancelled) return;
        const name = record.full_name?.trim() || ("display_name" in record ? record.display_name : null) || `${kind} profile #${record.id}`;
        setLoaded({
          id: record.id,
          name,
          created_by: record.created_by,
          initialValues: {
            display_name: ("display_name" in record ? record.display_name : null) || name,
            email: record.email,
            preferred_position: "preferred_position" in record ? record.preferred_position : null,
            level: "level" in record ? record.level : null,
            coaching_level: "coaching_level" in record ? record.coaching_level : null,
            qualifications: "qualifications" in record ? record.qualifications : null,
            visibility: record.visibility,
          },
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : `Failed to load the ${kind} profile.`);
      });
    return () => { cancelled = true; };
  }, [id, kind, numericId]);

  const handleSubmit = async (values: ProfileFormValues) => {
    if (!loaded) return;
    setErrors([]); setSavedName(null); setSubmitting(true);
    try {
      const saved = kind === "player"
        ? await api.updatePlayer(loaded.id, { player_profile: values.profile })
        : await api.updateCoach(loaded.id, { coach_profile: values.profile });
      setSavedName(saved.full_name?.trim() || ("display_name" in saved ? saved.display_name : null) || loaded.name);
    } catch (error: unknown) {
      setErrors(error instanceof ApiValidationError ? error.errors : [error instanceof Error ? error.message : `Failed to save the ${kind} profile.`]);
    } finally { setSubmitting(false); }
  };

  if (!loaded) return loadError ? <EmptyState title={kind === "player" ? "Player not found" : "Coach not found"} description={loadError} /> : <div className="loading">Loading...</div>;
  const backTo = kind === "player" ? `/players/${loaded.id}` : `/coaches/${loaded.id}`;
  const visibilityEditable = Boolean(user?.roles.includes("admin") || (user && loaded.created_by?.id === user.id));

  return <div className="page">
    <PageHeader title={`Edit ${loaded.name}`} description="Update volleyball profile details. Account and contact information is managed separately." />
    <div className="person-edit-back"><button className="back-link" onClick={() => navigate(backTo)}><ArrowLeft size={16} /> Back to {kind}</button></div>
    <section className="person-create-panel">
      <ProfileDetailsForm kind={kind} initialValues={loaded.initialValues} visibilityEditable={visibilityEditable} submitting={submitting} errors={errors} submitLabel="Save changes" onSubmit={handleSubmit} onCancel={() => navigate(backTo)} />
    </section>
    {savedName && <p className="related-item-meta person-saved" role="status">{savedName} saved.</p>}
  </div>;
}
