import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Drill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import { playerRangeLabel, trainingStageLabel } from "../../utils/drills";

export default function Drills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Drill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminDrills()
      .then(setDrills)
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
      await api.adminDestroyDrill(pendingDelete.id);
      setDrills((prev) => prev.filter((d) => d.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete drill.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title="Drills"
      description="Manage drills. Click a name to view details."
      backTo="/settings"
      backLabel="Back to Settings"
      actions={
        <Link to="/settings/drills/new" className="admin-btn admin-btn-add settings-add-btn">
          + Add New Drill
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
      <AdminTable<Drill>
        data={drills}
        loading={loading}
        emptyTitle="No drills"
        emptyDescription="Get started by adding a new drill."
        onEdit={(d) => navigate(`/settings/drills/${d.id}/edit`)}
        onDelete={(d) => {
          setPendingDelete(d);
          setDeleteError(null);
        }}
        columns={[
          {
            key: "title",
            label: "Name",
            render: (d) => (
              <Link to={`/settings/drills/${d.id}`} className="admin-table-name">
                {d.title}
              </Link>
            ),
          },
          { key: "stage", label: "Stage", render: (d) => trainingStageLabel(d.training_stage) },
          { key: "difficulty", label: "Difficulty", render: (d) => d.difficulty_level },
          {
            key: "players",
            label: "Players",
            render: (d) => playerRangeLabel(d.min_players, d.max_players),
          },
        ]}
      />
    </SettingsLayout>
  );
}
