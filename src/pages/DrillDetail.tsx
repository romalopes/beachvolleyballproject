import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Drill } from "../api";
import EmptyState from "../components/EmptyState";
import Tag from "../components/Tag";
import DrillViewer from "../components/drill/DrillViewer";
import CopyButton from "../components/CopyButton";
import { useAuth } from "../auth/AuthContext";
import DeleteConfirm from "../components/settings/DeleteConfirm";
import LineNumberedCode from "../components/LineNumberedCode";
import VideoList from "../components/video/VideoList";
import {
  resolveDrillDefinition,
  SAMPLE_DRILL_DEFINITION,
} from "../components/drill/definition";
import { ArrowLeft, Target, Users } from "lucide-react";
import {
  idealLabel,
  isValidDrillRange,
  trainingStageLabel,
} from "../utils/drills";

export default function DrillDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /**
   * Opt-in viewing of the built-in sample. A drill without a renderable
   * definition must never silently display one as if it were its own data.
   */
  const [showSample, setShowSample] = useState(false);
  /** Bumped after video reference changes so the drill (and its videos) refetch. */
  const [videosReloadKey, setVideosReloadKey] = useState(0);

  const isAdmin = user?.roles?.includes("admin");
  const canManageVideos = user?.roles?.some((role) => role === "coach" || role === "admin") ?? false;

  useEffect(() => {
    if (!slug) return;
    api
      .drill(slug)
      .then(setDrill)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug, videosReloadKey]);

  const handleDelete = async () => {
    if (!drill) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.adminDestroyDrill(drill.id);
      navigate("/drills");
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete drill.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!drill) return <EmptyState title="Drill not found" />;
  if (!isValidDrillRange(drill)) {
    return (
      <EmptyState
        title="Incomplete drill data"
        description="This drill is missing required training attributes."
      />
    );
  }

  /**
   * What is actually stored on the drill, and what the viewer can render from
   * it. `resolveDrillDefinition` returns `null` for the Rails `{}` column
   * default and for pre-`side` definitions, so the built-in sample is shown
   * only on request and always labelled.
   */
  const storedDefinition = drill.definition ?? null;
  const savedDefinition = resolveDrillDefinition(drill.definition);
  const viewerDefinition =
    savedDefinition ?? (showSample ? SAMPLE_DRILL_DEFINITION : null);
  const storedJson = JSON.stringify(storedDefinition ?? {}, null, 2);

  return (
    <div className="page">
      <div className="detail-header">
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="section-label">Drill</span>
        <h1>{drill.title}</h1>
        <div className="tags" style={{ marginTop: "1rem" }}>
          <Tag variant="primary">Drill</Tag>
          <Tag variant="teal">{drill.difficulty_level}</Tag>
          <Tag>{trainingStageLabel(drill.training_stage)}</Tag>
          <Tag>
            <Users
              size={12}
              style={{ marginRight: "0.25rem", verticalAlign: "middle" }}
            />
            Min: {drill.min_players} · Max: {drill.max_players}
          </Tag>
          <Tag>{idealLabel(drill.ideal_num_players)}</Tag>
        </div>
      </div>

      {isAdmin && (
        <div className="admin-actions-bar">
          <div className="admin-table-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => navigate(`/settings/drills/${drill.slug}/edit`)}
            >
              Edit
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

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

      <section className="detail-section">
        <h2>Setup Instructions</h2>
        <p>{drill.setup_instructions || "No instructions available."}</p>
      </section>

      <section className="detail-section">
        <h2>Drill Visualisation</h2>
        {viewerDefinition ? (
          <>
            {/* A sample has to announce itself: it is not this drill's data. */}
            {savedDefinition === null && (
              <p className="drill-notice" role="note">
                Sample drill — shown for reference only. This drill has no saved
                definition yet, so nothing below comes from it.
              </p>
            )}
            <DrillViewer definition={viewerDefinition} />
            {savedDefinition === null && (
              <div className="drill-visualisation-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setShowSample(false)}
                >
                  Hide sample
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="drill-visualisation-empty">
            <EmptyState
              title="No visualisation yet"
              description="This drill has no saved definition that can be rendered. An admin can build or fix one with Edit."
            />
            <div className="drill-visualisation-actions">
              <button
                type="button"
                className="admin-btn"
                onClick={() => setShowSample(true)}
              >
                Show a sample
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Drill Definition (JSON)</h2>
        {/* Always the value the API returned for this drill — never the sample,
            so this section cannot be mistaken for data the drill does not have. */}
        {savedDefinition === null && (
          <p className="drill-json-hint">
            This drill has no saved definition that can be rendered; the JSON
            below is what the API returned for it.
          </p>
        )}
        <details className="drill-json-details">
          <summary>
            Show / hide JSON
            {/* stopPropagation so the copy button doesn't toggle the details */}
            <CopyButton
              text={storedJson}
              label="Copy JSON"
              onClick={(e) => e.stopPropagation()}
            />
          </summary>
          <LineNumberedCode
            className="drill-json-code"
            code={storedJson}
            codeClassName="system-log-viewer drill-json-viewer"
          />
        </details>
      </section>

      <section className="detail-section">
        <h2>Related Skills</h2>
        {!drill.skills || drill.skills.length === 0 ? (
          <EmptyState
            title="No skills linked"
            description="Skills will appear here when associated with this drill."
          />
        ) : (
          <div className="related-list">
            {drill.skills.map((skill) => (
              <Link
                key={skill.id}
                to={`/skills/${skill.slug}`}
                className="related-item"
              >
                <span className="related-item-title">
                  <Target
                    size={16}
                    style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
                  />
                  {skill.title}
                </span>
                <span className="related-item-meta">
                  {skill.category?.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Videos</h2>
        <VideoList
          references={drill.video_references}
          target="drills"
          targetId={drill.id}
          canManage={canManageVideos}
          onChanged={() => setVideosReloadKey((key) => key + 1)}
        />
      </section>
    </div>
  );
}
