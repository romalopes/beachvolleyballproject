import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

export default function Skills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminSkills()
      .then(setSkills)
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
      await api.adminDestroySkill(pendingDelete.id);
      setSkills((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete skill.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title="Skills"
      description="Manage skills. Click a name to view details."
      backTo="/settings"
      backLabel="Back to Settings"
      actions={
        <Link to="/settings/skills/new" className="admin-btn admin-btn-add settings-add-btn">
          + Add New Skill
        </Link>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {pendingDelete && (
        <DeleteConfirm
          entityName={pendingDelete.title}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}
      <AdminTable<Skill>
        data={skills}
        loading={loading}
        emptyTitle="No skills"
        emptyDescription="Get started by adding a new skill."
        onEdit={(s) => navigate(`/settings/skills/${s.id}/edit`)}
        onDelete={(s) => {
          setPendingDelete(s);
          setDeleteError(null);
        }}
        columns={[
          {
            key: "title",
            label: "Name",
            render: (s) => (
              <Link to={`/settings/skills/${s.id}`} className="admin-table-name">
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
    </SettingsLayout>
  );
}
