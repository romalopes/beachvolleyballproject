import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Drill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DrillForm from "../../components/settings/resources/drills/DrillForm";
import VideoList from "../../components/video/VideoList";

export default function DrillFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !slug;
  const [initial, setInitial] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !slug) return;
    api
      .adminDrill(slug)
      .then(setInitial)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, isNew]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const backTo = isNew ? "/settings/drills" : `/drills/${slug}`;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <SettingsLayout
      title={isNew ? "New Drill" : "Edit Drill"}
      description={isNew ? "Create a new drill." : "Update this drill."}
      backTo={backTo}
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {/*
        Remount per drill: the form seeds its state once on mount (no effect
        writes state on the first render), so a different drill — or switching
        to a brand-new one — needs a fresh instance.
      */}
      <DrillForm
        key={isNew ? "new" : slug}
        initial={isNew ? null : initial}
        onCancel={() => navigate(backTo)}
        onSuccess={(saved) => navigate(`/drills/${saved.slug}`)}
      />

      {isNew || !initial ? (
        <p className="video-form-note">
          Save the drill first — videos can then be added here or from the
          drill's page.
        </p>
      ) : (
        <section className="detail-section">
          <h2>Videos</h2>
          <VideoList
            references={initial.video_references}
            target="drills"
            targetId={initial.id}
            canManage
            onChanged={() => {
              if (!slug) return;
              api
                .adminDrill(slug)
                .then(setInitial)
                .catch((e: Error) => setError(e.message));
            }}
          />
        </section>
      )}
    </SettingsLayout>
  );
}
