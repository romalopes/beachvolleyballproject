import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Drill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import EmptyState from "../../components/EmptyState";
import Tag from "../../components/Tag";
import { playerRangeLabel, trainingStageLabel } from "../../utils/drills";

export default function DrillDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .adminDrill(id)
      .then(setDrill)
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
      <SettingsLayout title="Drill" backTo="/settings/drills" backLabel="Back to Drills">
        <div className="auth-flash auth-flash-error">{error}</div>
      </SettingsLayout>
    );
  }
  if (!drill) {
    return (
      <SettingsLayout title="Drill" backTo="/settings/drills" backLabel="Back to Drills">
        <EmptyState title="Drill not found" />
      </SettingsLayout>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyDrill(drill.id);
      navigate("/settings/drills");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete drill.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title={drill.title}
      description={`${trainingStageLabel(drill.training_stage)} · ${drill.difficulty_level}`}
      backTo="/settings/drills"
      backLabel="Back to Drills"
      actions={
        <div className="admin-table-actions">
          <button type="button" className="admin-btn admin-btn-add" onClick={() => navigate(`/settings/drills/${drill.id}/edit`)}>
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
          entityName={drill.title}
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
        <h2>Setup Instructions</h2>
        <p>{drill.setup_instructions || "No setup instructions."}</p>
      </div>
      <div className="detail-section">
        <h2>Details</h2>
        <div className="tags">
          <Tag variant="primary">Drill</Tag>
          <Tag>{trainingStageLabel(drill.training_stage)}</Tag>
          <Tag>{drill.difficulty_level}</Tag>
          <Tag>{playerRangeLabel(drill.min_players, drill.max_players)}</Tag>
        </div>
        <p>Ideal players: {drill.ideal_num_players}</p>
        <p>
          <Link to={`/drills/${drill.slug}`}>View public drill page</Link>
        </p>
      </div>
      <div className="detail-section">
        <h2>Skills ({drill.skills?.length ?? 0})</h2>
        {!drill.skills || drill.skills.length === 0 ? (
          <EmptyState title="No skills linked" />
        ) : (
          <ul className="settings-link-list">
            {drill.skills.map((s) => (
              <li key={s.id}>
                <Link to={`/settings/skills/${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="detail-section">
        <h2>Media Assets ({drill.media_assets?.length ?? 0})</h2>
        {!drill.media_assets || drill.media_assets.length === 0 ? (
          <EmptyState title="No media assets" />
        ) : (
          <ul className="settings-link-list">
            {drill.media_assets.map((m) => (
              <li key={m.id}>{m.title}</li>
            ))}
          </ul>
        )}
      </div>
    </SettingsLayout>
  );
}
