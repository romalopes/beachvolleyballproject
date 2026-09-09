import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Category } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

export default function Categories() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminCategories()
      .then(setCategories)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyCategory(pendingDelete.id, confirmForce);
      setCategories((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
      setConfirmForce(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title="Categories"
      description="Manage categories. Click a name to view details."
      backTo="/settings"
      backLabel="Back to Settings"
      actions={
        <Link to="/settings/categories/new" className="admin-btn admin-btn-add settings-add-btn">
          + Add New Category
        </Link>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {pendingDelete && (
        <>
          <DeleteConfirm
            entityName={pendingDelete.name}
            warning="This action cannot be undone. If this category has skills, deletion will be blocked unless you confirm force-delete below."
            onCancel={() => {
              setPendingDelete(null);
              setDeleteError(null);
              setConfirmForce(false);
            }}
            onConfirm={handleDelete}
            deleting={deleting}
            error={deleteError}
          />
          <label className="delete-confirm-force">
            <input
              type="checkbox"
              checked={confirmForce}
              onChange={(e) => setConfirmForce(e.target.checked)}
            />
            Also delete skills in this category (force delete)
          </label>
        </>
      )}
      <AdminTable<Category>
        data={categories}
        loading={loading}
        emptyTitle="No categories"
        emptyDescription="Get started by adding a new category."
        onEdit={(c) => navigate(`/settings/categories/${c.id}/edit`)}
        onDelete={(c) => {
          setPendingDelete(c);
          setDeleteError(null);
          setConfirmForce(false);
        }}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (c) => (
              <Link to={`/settings/categories/${c.id}`} className="admin-table-name">
                {c.name}
              </Link>
            ),
          },
          { key: "slug", label: "Slug", render: (c) => c.slug },
        ]}
      />
    </SettingsLayout>
  );
}
