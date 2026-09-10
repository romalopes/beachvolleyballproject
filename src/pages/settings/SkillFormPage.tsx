import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import SkillForm from "../../components/settings/resources/skills/SkillForm";

export default function SkillFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !slug;
  const [initial, setInitial] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !slug) return;
    api
      .adminSkill(slug)
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

  const backTo = isNew ? "/settings/skills" : `/settings/skills/${slug}`;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <SettingsLayout
      title={isNew ? "New Skill" : "Edit Skill"}
      description={isNew ? "Create a new skill." : "Update this skill."}
      backTo={backTo}
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <SkillForm
        initial={isNew ? null : initial}
        onCancel={() => navigate(backTo)}
        onSuccess={(saved) => navigate(`/settings/skills/${saved.slug}`)}
      />
    </SettingsLayout>
  );
}
