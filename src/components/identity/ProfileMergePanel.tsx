import { useEffect, useState } from "react";
import { api, type Coach, type Player } from "../../api";

type Kind = "player" | "coach";
type Candidate = Pick<Player, "id" | "full_name" | "display_name"> | Pick<Coach, "id" | "full_name" | "display_name">;

interface Props {
  kind: Kind;
  sourceId: number;
  sourceName: string;
  onMerged: (canonicalId: number) => void;
}

/** Explicit, reviewed same-type merge controls. The backend remains authoritative. */
export default function ProfileMergePanel({ kind, sourceId, sourceName, onMerged }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = { q: query.trim() || undefined, status: "active" as const, include_private: true, page: 1, per_page: 100 };
    const request = kind === "player" ? api.players(params) : api.coaches(params);
    request.then((response) => {
      if (!cancelled) {
        setCandidates(response.data.filter((profile) => profile.id !== sourceId));
        setTargetId("");
      }
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load active profiles.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, open, query, sourceId]);

  const merge = async () => {
    const canonicalId = Number(targetId);
    if (!canonicalId || !reason.trim() || !confirmed) return;
    setWorking(true); setError(null);
    try {
      if (kind === "player") await api.mergePlayerProfile(sourceId, canonicalId, reason.trim());
      else await api.mergeCoachProfile(sourceId, canonicalId, reason.trim());
      onMerged(canonicalId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Profile merge was not completed.");
    } finally { setWorking(false); }
  };

  return <section className="detail-section profile-merge-panel">
    <h2>Merge duplicate profile</h2>
    {!open ? <button type="button" className="admin-btn" onClick={() => { setOpen(true); setError(null); }}>Choose a profile to merge into</button> : <>
      <p>Merge <strong>{sourceName}</strong> into another active {kind} profile. The source record is retained as an archived redirect, and its profile history is moved where records can be safely combined. This cannot be undone here.</p>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <label className="auth-field">Find active {kind} profiles<input aria-label={`Search ${kind} merge targets`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="auth-field">Merge into<select aria-label={`Merge ${kind} into`} value={targetId} onChange={(event) => { setTargetId(event.target.value); setConfirmed(false); }} disabled={loading || working}>
        <option value="">Choose a target profile</option>
        {candidates.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.display_name || `${kind} profile #${profile.id}`} · #{profile.id}</option>)}
      </select></label>
      {loading && <p role="status">Loading active profiles…</p>}
      {!loading && candidates.length === 0 && <p>No other active profiles match this search.</p>}
      <label className="auth-field">Reason for merge<textarea aria-label="Reason for profile merge" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} /></label>
      <label className="profile-merge-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm the selected profile is the record to keep. The source will be archived and linked to it.</label>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn admin-btn-remove" disabled={working || loading || !targetId || !reason.trim() || !confirmed} onClick={() => void merge()}>{working ? "Merging…" : "Confirm merge"}</button>
        <button type="button" className="admin-btn" disabled={working} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </>}
  </section>;
}
