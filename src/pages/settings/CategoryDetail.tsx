import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Category } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import EmptyState from "../../components/EmptyState";

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .adminCategory(id)
      .then(setCategory)
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
      <SettingsLayout title="Category" backTo="/settings/categories" backLabel="Back to Categories">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!category) {
    return (
      <SettingsLayout title="Category" backTo="/settings/categories" backLabel="Back to Categories">
        <EmptyState title="Category not found" />
      </SettingsLayout>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyCategory(category.id);
      navigate("/settings/categories");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title={category.name}
      description="Category details."
      backTo="/settings/categories"
      backLabel="Back to Categories"
      actions={
        <div className="admin-table-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={() => navigate(`/settings/categories/${category.id}/edit`)}>
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
          entityName={category.name}
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
        <h2>Details</h2>
        <p>Slug: {category.slug}</p>
        <p>
          <Link to="/settings/skills">View skills in this category</Link>
        </p>
      </div>
    </SettingsLayout>
  );
}
