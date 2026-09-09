import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import EmptyState from "../../components/EmptyState";
import Tag from "../../components/Tag";

export default function SkillDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .adminSkill(id)
      .then(setSkill)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <SettingsLayout title="Skill" backTo="/settings/skills" backLabel="Back to Skills">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!skill) {
    return (
      <SettingsLayout title="Skill" backTo="/settings/skills" backLabel="Back to Skills">
        <EmptyState title="Skill not found" />
      </SettingsLayout>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroySkill(skill.id);
      navigate("/settings/skills");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete skill.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title={skill.title}
      description={`Skill${skill.category ? ` · ${skill.category.name}` : ""}`}
      backTo="/settings/skills"
      backLabel="Back to Skills"
      actions={
        <div className="admin-table-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={() => navigate(`/settings/skills/${skill.id}/edit`)}>
            Edit
          </button>
          <button type="button" className="admin-btn admin-btn-remove" onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
      }
    >
      {confirming && (
        <DeleteConfirm
          entityName={skill.title}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}
      <div className="detail-section">
        <h2>Description</h2>
        <p>{skill.description || "No description available."}</p>
      </div>
      <div className="detail-section">
        <h2>Details</h2>
        <div className="tags">
          <Tag variant="primary">Skill</Tag>
          {skill.category && <Tag>{skill.category.name}</Tag>}
        </div>
        <p>
          <Link to={`/skills/${skill.slug}`}>View public skill page</Link>
        </p>
      </div>
    </SettingsLayout>
  );
}
