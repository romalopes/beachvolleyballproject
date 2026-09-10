import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Category, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import EmptyState from "../../components/EmptyState";
import ResourceTable from "../../components/settings/ResourceTable";

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.adminCategory(slug),
      api.adminSkills().catch(() => [] as Skill[]),
    ])
      .then(([cat, sk]) => {
        setCategory(cat);
        setSkills(sk);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const categorySkills = useMemo(
    () => skills.filter((s) => s.category_id === category?.id),
    [skills, category]
  );

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
          <button type="button" className="admin-btn admin-btn-add" onClick={() => navigate(`/settings/categories/${category.slug}/edit`)}>
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
      </div>
      <div className="detail-section">
        <h2>Skills in this category</h2>
        <ResourceTable<Skill>
          data={categorySkills}
          emptyTitle="No skills in this category"
          emptyDescription="Skills assigned to this category will appear here."
          columns={[
            {
              key: "title",
              label: "Name",
              render: (s) => (
                <Link to={`/settings/skills/${s.slug}`} className="admin-table-name">
                  {s.title}
                </Link>
              ),
            },
            { key: "category", label: "Category", render: (s) => s.category?.name ?? "—" },
            {
              key: "description",
              label: "Description",
              render: (s) =>
                s.description
                  ? s.description.length > 80
                    ? `${s.description.slice(0, 80)}…`
                    : s.description
                  : "—",
            },
          ]}
        />
      </div>
    </SettingsLayout>
  );
}
