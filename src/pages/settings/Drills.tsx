import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api, type Drill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import {
  DIFFICULTY_LEVELS,
  TRAINING_STAGES,
  playerRangeLabel,
  trainingStageLabel,
  type DifficultyLevel,
  type TrainingStage,
} from "../../utils/drills";

type SortKey = "name-asc" | "name-desc" | "stage" | "difficulty";

const STAGE_ORDER: TrainingStage[] = TRAINING_STAGES.map((s) => s.value);
const DIFFICULTY_ORDER: DifficultyLevel[] = DIFFICULTY_LEVELS.map((d) => d.value);

function drinksReferencedSkillName(drills: Drill[], skillId: number): string | undefined {
  for (const d of drills) {
    if (d.skills) {
      const match = d.skills.find((s) => s.id === skillId);
      if (match) return match.title;
    }
  }
  return undefined;
}

interface SkillOrigin {
  from?: string;
  fromPath?: string;
  skillName?: string;
}

export default function Drills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const origin = (location.state ?? null) as SkillOrigin | null;
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Drill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<number | "all">(() => {
    const raw = searchParams.get("skill");
    const parsed = raw !== null ? Number(raw) : NaN;
    return raw !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : "all";
  });
  const [stage, setStage] = useState<"all" | TrainingStage>("all");
  const [difficulty, setDifficulty] = useState<"all" | DifficultyLevel>("all");
  const [minFilter, setMinFilter] = useState("");
  const [maxFilter, setMaxFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");

  useEffect(() => {
    api
      .adminDrills()
      .then(setDrills)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const parsedMin = minFilter.trim() === "" ? null : Number(minFilter);
  const parsedMax = maxFilter.trim() === "" ? null : Number(maxFilter);
  const rangeError =
    parsedMin !== null &&
    parsedMax !== null &&
    !Number.isNaN(parsedMin) &&
    !Number.isNaN(parsedMax) &&
    parsedMin > parsedMax;

  // A ?skill= id that no drill references degrades to the full list.
  const effectiveSkillFilter =
    skillFilter !== "all" && !drills.some((d) => d.skills?.some((s) => s.id === skillFilter))
      ? "all"
      : skillFilter;

  const originSkillName =
    origin?.skillName ??
    (effectiveSkillFilter !== "all"
      ? drinksReferencedSkillName(drills, effectiveSkillFilter)
      : undefined);

  const filtersActive =
    search.trim() !== "" ||
    effectiveSkillFilter !== "all" ||
    stage !== "all" ||
    difficulty !== "all" ||
    minFilter.trim() !== "" ||
    maxFilter.trim() !== "" ||
    sort !== "name-asc";

  const visibleDrills = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = drills.filter((d) => {
      if (effectiveSkillFilter !== "all" && !d.skills?.some((s) => s.id === effectiveSkillFilter))
        return false;
      if (query && !d.title.toLowerCase().includes(query)) return false;
      if (stage !== "all" && d.training_stage !== stage) return false;
      if (difficulty !== "all" && d.difficulty_level !== difficulty) return false;
      // Overlap semantics on the drill's own stored range.
      if (parsedMin !== null && !Number.isNaN(parsedMin) && d.max_players < parsedMin)
        return false;
      if (parsedMax !== null && !Number.isNaN(parsedMax) && d.min_players > parsedMax)
        return false;
      if (rangeError) return false;
      return true;
    });

    const byTitle = (a: Drill, b: Drill) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

    switch (sort) {
      case "name-desc":
        return [...filtered].sort((a, b) => byTitle(b, a));
      case "stage":
        return [...filtered].sort(
          (a, b) =>
            STAGE_ORDER.indexOf(a.training_stage) -
              STAGE_ORDER.indexOf(b.training_stage) || byTitle(a, b)
        );
      case "difficulty":
        return [...filtered].sort(
          (a, b) =>
            DIFFICULTY_ORDER.indexOf(a.difficulty_level) -
              DIFFICULTY_ORDER.indexOf(b.difficulty_level) || byTitle(a, b)
        );
      default:
        return [...filtered].sort(byTitle);
    }
  }, [drills, search, effectiveSkillFilter, stage, difficulty, parsedMin, parsedMax, rangeError, sort]);

  const clearFilters = () => {
    setSearch("");
    setSkillFilter("all");
    setStage("all");
    setDifficulty("all");
    setMinFilter("");
    setMaxFilter("");
    setSort("name-asc");
  };

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
      {originSkillName && effectiveSkillFilter !== "all" && (
        <p className="settings-result-count">
          Showing drills linked to &ldquo;{originSkillName}&rdquo;.
          {origin?.fromPath && (
            <>
              {" "}
              <Link to={origin.fromPath} className="admin-table-name">
                Back to {origin.from ?? "Skills"}
              </Link>
            </>
          )}
        </p>
      )}
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
      <div className="settings-toolbar">
        <div className="search-bar settings-toolbar-search">
          <span className="search-bar-icon">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search drills by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search drills by name"
          />
        </div>
        <div className="settings-toolbar-row">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as "all" | TrainingStage)}
            aria-label="Filter by training stage"
          >
            <option value="all">All stages</option>
            {TRAINING_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "all" | DifficultyLevel)}
            aria-label="Filter by difficulty level"
          >
            <option value="all">All levels</option>
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder="Min players"
            value={minFilter}
            onChange={(e) => setMinFilter(e.target.value)}
            aria-label="Filter by min players"
          />
          <input
            type="number"
            min={1}
            placeholder="Max players"
            value={maxFilter}
            onChange={(e) => setMaxFilter(e.target.value)}
            aria-label="Filter by max players"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort drills"
          >
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="stage">Stage</option>
            <option value="difficulty">Difficulty</option>
          </select>
          {filtersActive && (
            <button type="button" className="admin-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="settings-result-count">
        {drills.length} {drills.length === 1 ? "drill" : "drills"}
      </p>
      {filtersActive && (
        <p className="settings-result-count">
          Showing {visibleDrills.length} of {drills.length} drill
          {drills.length === 1 ? "" : "s"}
        </p>
      )}
      {rangeError && (
        <div className="auth-flash auth-flash-error">
          Min players cannot exceed max players.
        </div>
      )}
      <AdminTable<Drill>
        data={visibleDrills}
        loading={loading}
        emptyTitle={filtersActive ? "No drills match these filters" : "No drills"}
        emptyDescription={
          filtersActive
            ? "Try adjusting your search or filter."
            : "Get started by adding a new drill."
        }
        onEdit={(d) => navigate(`/settings/drills/${d.slug}/edit`)}
        onDelete={(d) => {
          setPendingDelete(d);
          setDeleteError(null);
        }}
        columns={[
          {
            key: "title",
            label: "Name",
            render: (d) => (
              <Link to={`/settings/drills/${d.slug}`} className="admin-table-name">
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
