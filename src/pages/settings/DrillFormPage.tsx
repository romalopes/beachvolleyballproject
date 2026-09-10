import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Drill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DrillForm from "../../components/settings/resources/drills/DrillForm";

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

  const backTo = isNew ? "/settings/drills" : `/settings/drills/${slug}`;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <SettingsLayout
      title={isNew ? "New Drill" : "Edit Drill"}
      description={isNew ? "Create a new drill." : "Update this drill."}
      backTo={backTo}
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <DrillForm
        initial={isNew ? null : initial}
        onCancel={() => navigate(backTo)}
        onSuccess={(saved) => navigate(`/settings/drills/${saved.slug}`)}
      />
    </SettingsLayout>
  );
}
