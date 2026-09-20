import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api, type Category, type Drill, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";
import Pagination from "../../components/settings/Pagination";
import {
  DIFFICULTY_LEVELS,
  TRAINING_STAGES,
  trainingStageLabel,
  type DifficultyLevel,
  type TrainingStage,
} from "../../utils/drills";

const PER_PAGE = 20;
type SortKey = "name-asc" | "name-desc" | "stage" | "difficulty";
type DefinitionFilter = "all" | "with" | "without";

const STAGE_ORDER: TrainingStage[] = TRAINING_STAGES.map((s) => s.value);
const DIFFICULTY_ORDER: DifficultyLevel[] = DIFFICULTY_LEVELS.map((d) => d.value);
// Missing values sort last, after every known value.
const stageRank = (stage: Drill["training_stage"]) =>
  stage === null ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
const difficultyRank = (level: Drill["difficulty_level"]) =>
  level === null ? DIFFICULTY_ORDER.length : DIFFICULTY_ORDER.indexOf(level);

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
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Drill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [skillFilter, setSkillFilter] = useState<number | "all">(() => {
    const raw = searchParams.get("skill");
    const parsed = raw !== null ? Number(raw) : NaN;
    return raw !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : "all";
  });
  const [stage, setStage] = useState<"all" | "unspecified" | TrainingStage>("all");
  const [difficulty, setDifficulty] = useState<
    "all" | "unspecified" | DifficultyLevel
  >("all");
  const [minFilter, setMinFilter] = useState("");
  const [maxFilter, setMaxFilter] = useState("");
  const [definitionFilter, setDefinitionFilter] =
    useState<DefinitionFilter>("all");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.adminDrills(),
      api.adminSkills({ per_page: 1000 }),
      api.adminCategories({ per_page: 1000 }),
    ])
      .then(([drillsRes, skillsRes, categoriesRes]) => {
        setDrills(drillsRes.data);
        setAllSkills(skillsRes.data);
        setCategories(categoriesRes.data);
        // Never allow an empty category: default to the first one.
        if (categoriesRes.data.length > 0) {
          setCategoryFilter((prev) => prev ?? categoriesRes.data[0].id);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Skills offered within the selected category (selection persists but is
  // hidden when it no longer belongs to the current category).
  const skillsInCategory = useMemo(() => {
    if (categoryFilter === null) return allSkills;
    return allSkills.filter((skill) => skill.category_id === categoryFilter);
  }, [allSkills, categoryFilter]);

  const handleCategoryChange = (value: string) => {
    const nextId = Number(value);
    if (!Number.isInteger(nextId) || nextId <= 0) return;
    setCategoryFilter(nextId);
    setSkillFilter("all");
    setPage(1);
  };

  const handleSkillChange = (value: string) => {
    setSkillFilter(value === "all" ? "all" : Number(value));
    setPage(1);
  };
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

  // A skill selection that no longer belongs to the chosen category is treated
  // as unset, while the stored value persists for when the user switches back.
  const visibleSkillFilter =
    effectiveSkillFilter !== "all" &&
    categoryFilter !== null &&
    !allSkills.some(
      (s) =>
        s.id === effectiveSkillFilter &&
        (s.category_id === categoryFilter || s.category?.id === categoryFilter)
    )
      ? "all"
      : effectiveSkillFilter;

  const originSkillName =
    origin?.skillName ??
    (effectiveSkillFilter !== "all"
      ? drinksReferencedSkillName(drills, effectiveSkillFilter)
      : undefined);

  const activeCategoryName =
    categoryFilter === null
      ? undefined
      : categories.find((c) => c.id === categoryFilter)?.name;

  const filtersActive =
    search.trim() !== "" ||
    effectiveSkillFilter !== "all" ||
    stage !== "all" ||
    difficulty !== "all" ||
    minFilter.trim() !== "" ||
    maxFilter.trim() !== "" ||
    definitionFilter !== "all" ||
    sort !== "name-asc";

  const visibleDrills = useMemo(() => {
    const query = search.trim().toLowerCase();
    const categoryOfSkill = (s: Skill) => {
      if (s.category_id) return s.category_id;
      if (s.category?.id) return s.category.id;
      // The drill payload only carries {id,title,slug}; resolve from allSkills.
      return allSkills.find((full) => full.id === s.id)?.category_id;
    };
    const filtered = drills.filter((d) => {
      if (
        categoryFilter !== null &&
        !d.skills?.some((s) => categoryOfSkill(s) === categoryFilter)
      )
        return false;
      if (visibleSkillFilter !== "all" && !d.skills?.some((s) => s.id === visibleSkillFilter))
        return false;
      if (query && !d.title.toLowerCase().includes(query)) return false;
      if (stage === "unspecified") {
        if (d.training_stage !== null) return false;
      } else if (stage !== "all" && d.training_stage !== stage) return false;
      if (difficulty === "unspecified") {
        if (d.difficulty_level !== null) return false;
      } else if (difficulty !== "all" && d.difficulty_level !== difficulty)
        return false;
      // Overlap semantics on the drill's own stored range; drills without a
      // stored range cannot overlap any player window.
      if (parsedMin !== null && !Number.isNaN(parsedMin)) {
        if (d.max_players === null || d.max_players < parsedMin) return false;
      }
      if (parsedMax !== null && !Number.isNaN(parsedMax)) {
        if (d.min_players === null || d.min_players > parsedMax) return false;
      }
      if (rangeError) return false;
      // Tri-state visual-definition filter (Any / Has / None).
      if (definitionFilter === "with" && !d.has_definition) return false;
      if (definitionFilter === "without" && d.has_definition) return false;
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
            stageRank(a.training_stage) - stageRank(b.training_stage) ||
            byTitle(a, b)
        );
      case "difficulty":
        return [...filtered].sort(
          (a, b) =>
            difficultyRank(a.difficulty_level) -
              difficultyRank(b.difficulty_level) || byTitle(a, b)
        );
      default:
        return [...filtered].sort(byTitle);
    }
  }, [drills, allSkills, search, categoryFilter, visibleSkillFilter, stage, difficulty, parsedMin, parsedMax, rangeError, definitionFilter, sort]);

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter(categories.length > 0 ? categories[0].id : null);
    setSkillFilter("all");
    setStage("all");
    setDifficulty("all");
    setMinFilter("");
    setMaxFilter("");
    setDefinitionFilter("all");
    setSort("name-asc");
    setPage(1);
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
      {activeCategoryName && (
        <p className="settings-result-count">
          Showing drills in category &ldquo;{activeCategoryName}&rdquo;.
        </p>
      )}
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
            value={categoryFilter === null ? "" : String(categoryFilter)}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="Filter by category"
            disabled={categories.length === 0}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={visibleSkillFilter === "all" ? "all" : String(visibleSkillFilter)}
            onChange={(e) => handleSkillChange(e.target.value)}
            aria-label="Filter by skill"
            disabled={skillsInCategory.length === 0}
          >
            <option value="all">All skills</option>
            {skillsInCategory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as "all" | "unspecified" | TrainingStage);
              setPage(1);
            }}
            aria-label="Filter by training stage"
          >
            <option value="all">All stages</option>
            {TRAINING_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="unspecified">Unspecified</option>
          </select>
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(
                e.target.value as "all" | "unspecified" | DifficultyLevel,
              );
              setPage(1);
            }}
            aria-label="Filter by difficulty level"
          >
            <option value="all">All levels</option>
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
            <option value="unspecified">Unspecified</option>
          </select>
          <input
            type="number"
            min={1}
            placeholder="Min players"
            value={minFilter}
            onChange={(e) => {
              setMinFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by min players"
          />
          <input
            type="number"
            min={1}
            placeholder="Max players"
            value={maxFilter}
            onChange={(e) => {
              setMaxFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by max players"
          />
          <select
            value={definitionFilter}
            onChange={(e) => {
              setDefinitionFilter(e.target.value as DefinitionFilter);
              setPage(1);
            }}
            aria-label="Filter by visual definition"
          >
            <option value="all">Any definition</option>
            <option value="with">Has a definition</option>
            <option value="without">No definition</option>
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setPage(1);
            }}
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
        {visibleDrills.length} {visibleDrills.length === 1 ? "drill" : "drills"}
      </p>
      {filtersActive && visibleDrills.length > PER_PAGE && (
        <p className="settings-result-count">
          Page {page} of {Math.ceil(visibleDrills.length / PER_PAGE)}
        </p>
      )}
      {rangeError && (
        <div className="auth-flash auth-flash-error">
          Min players cannot exceed max players.
        </div>
      )}
      <AdminTable<Drill>
        data={visibleDrills.slice((page - 1) * PER_PAGE, page * PER_PAGE)}
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
              <Link to={`/drills/${d.slug}`} className="admin-table-name">
                {d.title}
              </Link>
            ),
          },
          { key: "stage", label: "Stage", render: (d) => trainingStageLabel(d.training_stage) ?? "—" },
          { key: "difficulty", label: "Difficulty", render: (d) => d.difficulty_level ?? "—" },
          {
            key: "skills",
            label: "Skills",
            render: (d) =>
              !d.skills || d.skills.length === 0 ? (
                "—"
              ) : (
                <span className="admin-table-skills">
                  {d.skills.map((s, index) => (
                    <span key={s.id}>
                      <Link to={`/skills/${s.slug}`} className="admin-table-name">
                        {s.title}
                      </Link>
                      {index < (d.skills?.length ?? 0) - 1 ? ", " : ""}
                    </span>
                  ))}
                </span>
              ),
          },
        ]}
      />
      {visibleDrills.length > PER_PAGE && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(visibleDrills.length / PER_PAGE)}
          totalItems={visibleDrills.length}
          itemsPerPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </SettingsLayout>
  );
}
