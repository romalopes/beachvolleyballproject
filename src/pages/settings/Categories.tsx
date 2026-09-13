import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Category, type PaginationMeta, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import Pagination from "../../components/settings/Pagination";

const PER_PAGE = 20;

export default function Categories() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsFailed, setSkillsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    Promise.all([
      api.adminCategories({ page, per_page: PER_PAGE }),
      api.adminSkills({ per_page: 1000 }).catch(() => {
        setSkillsFailed(true);
        return { data: [] as Skill[], meta: { page: 1, per_page: 1000, total: 0, total_pages: 1 } };
      }),
    ])
      .then(([catsRes, skRes]) => {
        setCategories(catsRes.data);
        setMeta(catsRes.meta);
        setSkills(skRes.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  const skillCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!skills) return counts;
    skills.forEach((s) => {
      counts.set(s.category_id, (counts.get(s.category_id) ?? 0) + 1);
    });
    return counts;
  }, [skills]);

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
      <p className="settings-result-count">
        {meta ? `${meta.total} ${meta.total === 1 ? "category" : "categories"}` : `${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
      </p>
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
        onEdit={(c) => navigate(`/settings/categories/${c.slug}/edit`)}
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
              <Link to={`/settings/categories/${c.slug}`} className="admin-table-name">
                {c.name}
              </Link>
            ),
          },
          { key: "slug", label: "Slug", render: (c) => c.slug },
          {
            key: "skills",
            label: "Skills",
            render: (c) => {
              if (skillsFailed) return "—";
              const count = skillCounts.get(c.id) ?? 0;
              return (
                <Link
                  to={`/settings/skills?category=${c.id}`}
                  state={{ from: "Categories", fromPath: "/settings/categories", categoryName: c.name }}
                  className="admin-table-name"
                >
                  {count}
                </Link>
              );
            },
          },
        ]}
      />
      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </SettingsLayout>
  );
}
