import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Trash2,
  Undo2,
  User,
} from "lucide-react";
import {
  api,
  type AssessmentSession,
  type AssessmentSessionPlayerInput,
  type AssessmentSessionScoreInput,
  type Player,
} from "../api";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import Tag from "../components/Tag";
import AssessmentSessionRoster from "../components/assessments/AssessmentSessionRoster";
import SpreadsheetScoreGrid from "../components/assessments/SpreadsheetScoreGrid";
import SessionRankingTable from "../components/assessments/SessionRankingTable";
import SessionConsolidations from "../components/assessments/SessionConsolidations";

type SessionTab = "roster" | "scores" | "ranking" | "consolidated";

const tabs: Array<{ id: SessionTab; label: string }> = [
  { id: "roster", label: "Roster" },
  { id: "scores", label: "Scores" },
  { id: "ranking", label: "Ranking" },
  { id: "consolidated", label: "Ranking Consolidated" },
];

export default function AssessmentSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sessionId = Number(id);

  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("roster");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Impersonation is excluded on purpose: an admin browsing as somebody else must
  // not be offered the restore and permanent-delete controls.
  const isAdmin =
    !!user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;

  // `loading` is derived from the id on screen instead of being synced by an
  // effect — an effect that called `setLoading` would cascade a second render on
  // every navigation. Same approach as AdminUsers.tsx.
  const invalidId = !Number.isFinite(sessionId);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const loading = !invalidId && loadedId !== sessionId;

  /**
   * Server-side player search for the roster picker. Searching on demand rather
   * than prefetching a page of the catalogue means no player is unreachable,
   * and a failure is reported as a search failure rather than as an empty
   * candidate list (which reads as "no players exist").
   */
  const searchPlayers = async (term: string): Promise<Player[]> => {
    const res = await api.players({
      q: term,
      include_private: true,
      per_page: 20,
    });
    return res.data || [];
  };

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    let cancelled = false;
    api
      .assessmentSession(sessionId)
      .then((sessionRes) => {
        if (cancelled) return;
        setSession(sessionRes.assessment_session);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assessment session.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoadedId(sessionId);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  const handleAddPlayers = async (players: AssessmentSessionPlayerInput[]) => {
    if (!session) return;
    setActionError(null);
    const res = await api.addAssessmentSessionPlayers(session.id, players);
    setSession(res.assessment_session);
  };

  const handleRemovePlayers = async (playerProfileIds: number[]) => {
    if (!session) return;
    setActionError(null);
    const res = await api.removeAssessmentSessionPlayers(
      session.id,
      playerProfileIds,
    );
    setSession(res.assessment_session);
  };

  const handleSaveScores = async (scores: AssessmentSessionScoreInput[]) => {
    if (!session) return;
    setActionError(null);
    const res = await api.saveAssessmentSessionScores(session.id, scores);
    setSession(res.assessment_session);
  };

  const handlePublish = async () => {
    if (!session) return;
    setActionError(null);
    setPublishing(true);
    try {
      const res = await api.publishAssessmentSession(session.id);
      setSession(res.assessment_session);
      setActiveTab("ranking");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to publish session.",
      );
    } finally {
      setPublishing(false);
    }
  };

  /**
   * Discard this draft and return to the list.
   *
   * The confirmation says what is actually lost — the roster and the unscored
   * grid — because "are you sure?" alone would let a coach delete a session they
   * spent an hour filling in. Only drafts reach here: the button is not rendered
   * otherwise, and the server refuses a published one regardless.
   */
  const handleDelete = async () => {
    if (!session) return;
    // The wording follows the state: a draft is scratch, whereas a published or
    // withdrawn session holds results about named players and may be removed only
    // by an admin, so the stakes are named rather than softened.
    const prompt =
      session.status === "draft"
        ? `Delete draft "${session.name}"? Its roster and any unscored grid are discarded. This cannot be undone.`
        : `Permanently delete "${session.name}"? Its published results about named players are destroyed, along with any ranking that still points at it. This cannot be undone — withdrawing is reversible.`;

    if (!window.confirm(prompt)) {
      return;
    }

    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteAssessmentSession(session.id);
      navigate("/assessment-sessions");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete the session.",
      );
    } finally {
      setDeleting(false);
    }
  };

  /** Retract a published session. Reversible: only an admin can restore it. */
  const handleWithdraw = async () => {
    if (!session) return;
    if (
      !window.confirm(
        `Withdraw "${session.name}"? Its results stop counting as a current assessment, and only an admin can restore it.`,
      )
    ) {
      return;
    }
    setWithdrawing(true);
    setActionError(null);
    try {
      const res = await api.withdrawAssessmentSession(session.id);
      setSession(res.assessment_session);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to withdraw the session.",
      );
    } finally {
      setWithdrawing(false);
    }
  };

  /** Admin only. Restoring to published re-runs the full publish checks. */
  const handleRestore = async (to: "draft" | "published") => {
    if (!session) return;
    setRestoring(true);
    setActionError(null);
    try {
      const res = await api.restoreAssessmentSession(session.id, to);
      setSession(res.assessment_session);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to restore the session.",
      );
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="page assessment-session-detail-page">
        <p className="loading">Loading assessment session...</p>
      </div>
    );
  }

  if (invalidId || error || !session) {
    return (
      <div className="page assessment-session-detail-page">
        <EmptyState
          title="Assessment session not found"
          description={
            invalidId
              ? "Invalid assessment session id."
              : (error ??
                "This session does not exist or you do not have access to it.")
          }
        />
        <p>
          <Link to="/assessment-sessions" className="admin-btn">
            Back to sessions
          </Link>
        </p>
      </div>
    );
  }

  const isDraft = session.status === "draft";
  const isWithdrawn = session.status === "withdrawn";
  // A draft is discarded by anyone who may edit it. A published or withdrawn one
  // is admin-only, matching the server: a withdrawal must not be reversible by its
  // own author, and destroying published results is the narrowest power here.
  const canDelete = isDraft || isAdmin;
  const categories = [
    ...(session.assessment_definition?.assessment_categories || []),
  ].sort((a, b) => a.position - b.position);

  return (
    <div className="page assessment-session-detail-page">
      <p className="session-back-link">
        <Link to="/assessment-sessions" className="back-link">
          <ArrowLeft size={14} />
          All sessions
        </Link>
      </p>
      <PageHeader title={session.name} description={session.notes || undefined}>
        <div className="session-meta">
          <Tag variant={session.status === "published" ? "teal" : "default"}>
            {session.status_label || session.status}
          </Tag>
          <span className="session-meta-item">
            <Calendar size={14} />
            {formatDate(session.scheduled_on)}
          </span>
          <span className="session-meta-item">
            <User size={14} />
            {session.coach_profile?.full_name}
          </span>
          <span className="session-meta-item">
            Rubric: {session.assessment_definition?.name}
          </span>
        </div>
        {isDraft && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => void handlePublish()}
              disabled={publishing}
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => void handleDelete()}
              disabled={deleting || publishing}
            >
              <Trash2 size={14} />
              {deleting ? "Deleting..." : "Delete draft"}
            </button>
          </div>
        )}
        {/* Withdrawing is the ordinary, reversible retraction of a published
            session, so it sits beside Publish rather than in the danger zone. */}
        {session.status === "published" && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => void handleWithdraw()}
              disabled={withdrawing}
            >
              {withdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
          </div>
        )}
        {/* A withdrawn session is inert. Only an admin brings it back, and
            restoring to published re-runs the full publish checks. */}
        {isWithdrawn && isAdmin && (
          <div className="admin-form-actions session-actions">
            <button
              type="button"
              className="admin-btn admin-btn-add"
              onClick={() => void handleRestore("published")}
              disabled={restoring}
            >
              <Undo2 size={14} />
              {restoring ? "Restoring..." : "Restore to published"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-remove"
              onClick={() => void handleRestore("draft")}
              disabled={restoring}
            >
              Restore to draft
            </button>
          </div>
        )}
      </PageHeader>

      {/* The irreversible action is set apart from the reversible ones, because it
          is the only control here that cannot be taken back. */}
      {canDelete && !isDraft && (
        <div className="admin-form-actions session-actions consolidation-danger-zone">
          <button
            type="button"
            className="admin-btn admin-btn-remove"
            onClick={() => void handleDelete()}
            disabled={deleting || withdrawing || restoring}
          >
            <Trash2 size={14} />
            {deleting ? "Deleting..." : "Delete permanently"}
          </button>
          <p className="field-hint">
            Removes this session and its published results for good. Withdrawing
            is the reversible option.
          </p>
        </div>
      )}

      {actionError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      <div
        className="session-tabs"
        role="tablist"
        aria-label="Session sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id ? "session-tab active" : "session-tab"
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "roster" && (
        <AssessmentSessionRoster
          participants={session.participants || []}
          searchPlayers={searchPlayers}
          isDraft={isDraft}
          onAddPlayers={handleAddPlayers}
          onRemovePlayers={handleRemovePlayers}
        />
      )}

      {activeTab === "scores" && (
        <SpreadsheetScoreGrid
          categories={categories}
          participants={session.participants || []}
          isDraft={isDraft}
          onSaveScores={handleSaveScores}
        />
      )}

      {activeTab === "ranking" && (
        <SessionRankingTable
          categories={categories}
          rankingPayload={session.ranking}
        />
      )}

      {activeTab === "consolidated" && (
        <SessionConsolidations consolidations={session.consolidations || []} />
      )}
    </div>
  );
}
