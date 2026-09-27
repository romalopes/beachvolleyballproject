import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, Calendar, User } from "lucide-react";
import {
  api,
  type AssessmentSession,
  type AssessmentSessionPlayerInput,
  type AssessmentSessionScoreInput,
  type Player,
} from "../api";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Tag from "../components/Tag";
import AssessmentSessionRoster from "../components/assessments/AssessmentSessionRoster";
import SpreadsheetScoreGrid from "../components/assessments/SpreadsheetScoreGrid";
import SessionRankingTable from "../components/assessments/SessionRankingTable";

type SessionTab = "roster" | "scores" | "ranking";

const tabs: Array<{ id: SessionTab; label: string }> = [
  { id: "roster", label: "Roster" },
  { id: "scores", label: "Scores" },
  { id: "ranking", label: "Ranking" },
];

export default function AssessmentSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [activeTab, setActiveTab] = useState<SessionTab>("roster");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

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
          err instanceof Error ? err.message : "Failed to load assessment session.",
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
    const res = await api.removeAssessmentSessionPlayers(session.id, playerProfileIds);
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
      setActionError(err instanceof Error ? err.message : "Failed to publish session.");
    } finally {
      setPublishing(false);
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
              : error ?? "This session does not exist or you do not have access to it."
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
  const categories = [...(session.assessment_definition?.assessment_categories || [])].sort(
    (a, b) => a.position - b.position,
  );

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
          </div>
        )}
      </PageHeader>

      {actionError && (
        <div className="admin-error" role="alert">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="session-tabs" role="tablist" aria-label="Session sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "session-tab active" : "session-tab"}
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
        <SessionRankingTable categories={categories} rankingPayload={session.ranking} />
      )}
    </div>
  );
}