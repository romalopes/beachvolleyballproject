import { useEffect, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { api, type Coach, type CoachContext, type Player, type PlayerCoach } from "../../api";
import DeleteConfirm from "../settings/DeleteConfirm";
import EmptyState from "../EmptyState";
import Tag from "../Tag";

/**
 * The coaching relationships for one side of the pair: the coaches of a player,
 * or the players of a coach (plan Phase 5).
 *
 * The relationship is a *period*, not a permission — a coach may assess a player
 * with no row here at all — so the copy says that rather than implying anything
 * about who may rate whom. Ending a period is an update, never a delete: the row
 * is what makes a past assessment explicable, and a resumed relationship becomes
 * a *new* period rather than reopening this one.
 *
 * The side comes from the page (the profile it already shows) and the
 * permissions are passed in, so the component stays free of auth rules and every
 * branch below is reachable in a unit test.
 */
type Side = "player" | "coach";

interface CoachingRelationshipsProps {
  /** Which side of the relationship the page is showing. */
  side: Side;
  /** The profile this page is about: a `player_profile_id` or a `coach_profile_id`. */
  profileId: number;
  /** May this viewer start and end relationships? Computed by the page. */
  canManage: boolean;
  /**
   * The viewer's own coach profile. On a player page a non-admin records *their
   * own* coaching, so no coach picker is shown and this is the coach.
   */
  viewerCoachProfileId?: number | null;
  /** The signed-in Person's profiles, used to pick an attribution context. */
  viewerCoachProfiles?: CoachContext[];
  /** Admins may attribute a relationship to any coach; a coach only to themselves. */
  isAdmin: boolean;
}

/** Local `YYYY-MM-DD`, not UTC: `toISOString()` would be tomorrow in Sydney. */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Format an ISO date without the UTC shift `new Date(string)` would apply. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayName(
  person: { full_name?: string; person?: { first_name: string; last_name: string | null } | null },
): string {
  return (
    person.full_name?.trim() ||
    `${person.person?.first_name ?? ""} ${person.person?.last_name ?? ""}`.trim() ||
    "Unnamed"
  );
}

export default function CoachingRelationships({
  side,
  profileId,
  canManage,
  viewerCoachProfileId,
  viewerCoachProfiles = [],
  isAdmin,
}: CoachingRelationshipsProps) {
  const [rows, setRows] = useState<PlayerCoach[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [working, setWorking] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [ending, setEnding] = useState<PlayerCoach | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [otherId, setOtherId] = useState<number | "">("");

  // lookup maps for names
  const playerNameMap = useMemo(
    () =>
      new Map(
        players.map((p) => [
          p.id,
          p.full_name?.trim() ||
            `${p.person?.first_name ?? ""} ${p.person?.last_name ?? ""}`.trim() ||
            `Player #${p.id}`,
        ])
      ),
    [players]
  );

  const coachNameMap = useMemo(
    () =>
      new Map(
        coaches.map((c) => [
          c.id,
          c.full_name?.trim() ||
            `${c.person?.first_name ?? ""} ${c.person?.last_name ?? ""}`.trim() ||
            `Coach #${c.id}`,
        ])
      ),
    [coaches]
  );
  const activeViewerProfiles = viewerCoachProfiles.filter((profile) => profile.status === "active");
  const [selectedViewerCoachId, setSelectedViewerCoachId] = useState<number | null>(
    viewerCoachProfileId ?? activeViewerProfiles[0]?.id ?? null,
  );

  /**
   * On a player page a plain coach records themselves, so there is nothing to
   * choose and no reason to load a coach list. A picker only appears for an
   * admin (any coach) or on the coach side (any player).
   */
  const needsOwnCoachPicker = side === "player" && !isAdmin && activeViewerProfiles.length > 1;
  const fixedCoachId = side === "player" && !isAdmin
    ? (needsOwnCoachPicker ? selectedViewerCoachId : (activeViewerProfiles[0]?.id ?? viewerCoachProfileId ?? null))
    : null;
  const showForm =
    canManage && (side === "coach" || isAdmin || activeViewerProfiles.length > 0 || Boolean(viewerCoachProfileId));
  const needsPlayerPicker = showForm && side === "coach";
  const needsCoachPicker = showForm && side === "player" && isAdmin;
  const chosenOtherId: number | null =
    fixedCoachId ?? (otherId === "" ? null : otherId);

  const describe = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong.";

  const queryKey = `${side}:${profileId}:${reloadKey}`;
  const loading = loadedQuery !== queryKey;

  useEffect(() => {
    let cancelled = false;
    const query =
      side === "player"
        ? { player_profile_id: profileId }
        : { coach_profile_id: profileId };
    api
      .playerCoaches(query)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setListError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setListError(describe(err));
      })
      .finally(() => {
        if (!cancelled) setLoadedQuery(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [side, profileId, reloadKey, queryKey]);

  useEffect(() => {
    if (!needsPlayerPicker) return;
    let cancelled = false;
    api
      .players({ status: "active", include_private: true, per_page: 100 })
      .then((page) => {
        if (!cancelled) setPlayers(page.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStartError(describe(err));
      });
    return () => {
      cancelled = true;
    };
  }, [needsPlayerPicker]);

  useEffect(() => {
    if (!needsCoachPicker) return;
    let cancelled = false;
    api
      .coaches({ status: "active", include_private: true, per_page: 100 })
      .then((page) => {
        if (!cancelled) setCoaches(page.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStartError(describe(err));
      });
    return () => {
      cancelled = true;
    };
  }, [needsCoachPicker]);

  const reload = () => setReloadKey((key) => key + 1);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosenOtherId) return;
    setWorking(true);
    setStartError(null);
    try {
      await api.createPlayerCoach(
        side === "player"
          ? {
              player_profile_id: profileId,
              coach_profile_id: chosenOtherId,
              start_date: startDate,
            }
          : {
              player_profile_id: chosenOtherId,
              coach_profile_id: profileId,
              start_date: startDate,
            },
      );
      setOtherId("");
      setStartDate(todayISO());
      reload();
    } catch (err: unknown) {
      setStartError(describe(err));
    } finally {
      setWorking(false);
    }
  };

  /** Ends *today*; the period keeps its own dates and is never removed. */
  const handleEnd = async () => {
    if (!ending) return;
    setWorking(true);
    setEndError(null);
    try {
      await api.endPlayerCoach(ending.id);
      setEnding(null);
      reload();
    } catch (err: unknown) {
      setEndError(describe(err));
    } finally {
      setWorking(false);
    }
  };

  const current = rows.filter((row) => row.current);
  const former = rows.filter((row) => !row.current);
  const otherLabel = side === "player" ? "Coach" : "Player";

  const renderRow = (row: PlayerCoach) => {
    const displayName = side === "player"
      ? (coachNameMap.get(row.coach_profile_id) ?? row.coach_name ?? `Coach #${row.coach_profile_id}`)
      : (playerNameMap.get(row.player_profile_id) ?? row.player_name ?? `Player #${row.player_profile_id}`);

    return (
      <li key={row.id} className="coaching-row">
        <span className="coaching-row-name">
          {displayName}
        </span>
        <span className="coaching-row-meta">
          {formatDate(row.start_date)} – {row.end_date ? formatDate(row.end_date) : "present"}
          {row.duration_in_days != null ? ` · ${row.duration_in_days} days` : ""}
        </span>
        <Tag variant={row.current ? "teal" : "default"}>
          {row.current ? "Current" : "Former"}
        </Tag>
        {canManage && row.current && (
          <button
            type="button"
            className="admin-btn"
            disabled={working}
            onClick={() => {
              setEndError(null);
              setEnding(row);
            }}
          >
            End
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="detail-section coaching-relationships">
      <h2>Coaching relationships</h2>
      <p className="related-item-meta">
        {side === "player"
          ? "Who coaches this player, and since when. A coach does not need a relationship here to assess them — ending one retracts nothing."
          : "Who this coach coaches, and since when. A period that ends stays on the record."}
      </p>

      {showForm && (
        <form className="coaching-add" onSubmit={handleStart}>
          {needsOwnCoachPicker && (
            <label>
              Coach profile
              <select
                aria-label="Coach profile"
                value={selectedViewerCoachId ?? ""}
                onChange={(event) => setSelectedViewerCoachId(Number(event.target.value))}
              >
                {activeViewerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.coaching_level ? `${profile.coaching_level} · ` : ""}Profile #{profile.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsPlayerPicker ? (
            <label>
              Player
              <select
                aria-label="Player to add"
                value={otherId}
                disabled={working}
                onChange={(event) => setOtherId(Number(event.target.value) || "")}
              >
                <option value="">— Select player —</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {displayName(player)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {needsCoachPicker ? (
            <label>
              Coach
              <select
                aria-label="Coach to add"
                value={otherId}
                disabled={working}
                onChange={(event) => setOtherId(Number(event.target.value) || "")}
              >
                <option value="">— Select coach —</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {displayName(coach)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Starting
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              max={todayISO()}
              disabled={working}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="admin-btn admin-btn-add"
            disabled={working || !chosenOtherId}
          >
            <Plus size={14} /> Add {otherLabel.toLowerCase()}
          </button>

          {fixedCoachId ? (
            <span className="related-item-meta coaching-add-hint">
              This records you as this player&apos;s coach.
            </span>
          ) : null}

          {startError && <p className="admin-error coaching-add-error">{startError}</p>}
        </form>
      )}

      {loading ? (
        <p className="related-item-meta">Loading…</p>
      ) : listError ? (
        <div className="admin-error">{listError}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No coaching relationships yet"
          description={
            side === "player"
              ? "No coach is on record for this player."
              : "No player is on record for this coach."
          }
        />
      ) : (
        <>
          <ul className="coaching-list">
            {current.length > 0
              ? current.map(renderRow)
              : <li className="coaching-empty">No current relationship.</li>}
          </ul>

          {former.length > 0 && (
            <>
              <h4 className="coaching-group-title">Former ({former.length})</h4>
              <ul className="coaching-list">{former.map(renderRow)}</ul>
            </>
          )}
        </>
      )}

      {ending && (
        <DeleteConfirm
          entityName={
            side === "player"
              ? ending.coach_name || "this coach"
              : ending.player_name || "this player"
          }
          title="End this coaching relationship?"
          warning="It ends today and the period stays on the record with its own dates — assessments recorded while it ran are unaffected. Resuming later starts a new period rather than reopening this one."
          confirmLabel="End today"
          pendingLabel="Ending..."
          deleting={working}
          error={endError}
          onCancel={() => {
            setEnding(null);
            setEndError(null);
          }}
          onConfirm={handleEnd}
        />
      )}
    </section>
  );
}
