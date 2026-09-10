import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api, type Drill, type Skill } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import AdminTable from "../../components/settings/AdminTable";
import DeleteConfirm from "../../components/settings/DeleteConfirm";

type SortKey = "name-asc" | "name-desc" | "category";

interface CategoryOrigin {
  from?: string;
  fromPath?: string;
  categoryName?: string;
}

export default function Skills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const origin = (location.state ?? null) as CategoryOrigin | null;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [drillsFailed, setDrillsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">(() => {
    const raw = searchParams.get("category");
    const parsed = raw !== null ? Number(raw) : NaN;
    return raw !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : "all";
  });
  const [sort, setSort] = useState<SortKey>("name-asc");

  useEffect(() => {
    Promise.all([
      api.adminSkills(),
      api.adminDrills().catch(() => {
        setDrillsFailed(true);
        return [] as Drill[];
      }),
    ])
      .then(([sk, dr]) => {
        setSkills(sk);
        setDrills(dr);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const byId = new Map<number, string>();
    skills.forEach((s) => {
      if (s.category) byId.set(s.category.id, s.category.name);
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [skills]);

  const drillCounts = useMemo(() => {
    const counts = new Map<number, number>();
    drills.forEach((d) => {
      d.skills?.forEach((s) => {
        counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      });
    });
    return counts;
  }, [drills]);

  // A ?category= id that matches no loaded category degrades to the full list.
  const effectiveCategoryFilter =
    categoryFilter !== "all" && !categories.some((c) => c.id === categoryFilter)
      ? "all"
      : categoryFilter;

  const originCategoryName =
    origin?.categoryName ??
    (effectiveCategoryFilter !== "all"
      ? categories.find((c) => c.id === effectiveCategoryFilter)?.name
      : undefined);

  const filtersActive =
    search.trim() !== "" || effectiveCategoryFilter !== "all" || sort !== "name-asc";

  const visibleSkills = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = skills.filter((s) => {
      if (query && !s.title.toLowerCase().includes(query)) return false;
      if (effectiveCategoryFilter !== "all" && s.category_id !== effectiveCategoryFilter) return false;
      return true;
    });

    const byTitle = (a: Skill, b: Skill) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

    switch (sort) {
      case "name-desc":
        return [...filtered].sort((a, b) => byTitle(b, a));
      case "category":
        return [...filtered].sort(
          (a, b) =>
            (a.category?.name ?? "\uFFFF").localeCompare(
              b.category?.name ?? "\uFFFF",
              undefined,
              { sensitivity: "base" }
            ) || byTitle(a, b)
        );
      default:
        return [...filtered].sort(byTitle);
    }
  }, [skills, search, effectiveCategoryFilter, sort]);

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
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
      backLabel="Back"
      backFallback="/settings"
      actions={
        <Link to="/settings/skills/new" className="admin-btn admin-btn-add settings-add-btn">
          + Add New Skill
        </Link>
      }
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {originCategoryName && effectiveCategoryFilter !== "all" && (
        <p className="settings-result-count">
          Showing skills in &ldquo;{originCategoryName}&rdquo;.
          {origin?.fromPath && (
            <>
              {" "}
              <Link to={origin.fromPath} className="admin-table-name">
                Back to {origin.from ?? "Categories"}
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
            placeholder="Search skills by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search skills by name"
          />
        </div>
        <div className="settings-toolbar-row">
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort skills"
          >
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="category">Category</option>
          </select>
          {filtersActive && (
            <button type="button" className="admin-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="settings-result-count">
        {skills.length} {skills.length === 1 ? "skill" : "skills"}
      </p>
      {filtersActive && (
        <p className="settings-result-count">
          Showing {visibleSkills.length} of {skills.length} skill
          {skills.length === 1 ? "" : "s"}
        </p>
      )}
      <AdminTable<Skill>
        data={visibleSkills}
        loading={loading}
        emptyTitle={filtersActive ? "No skills match these filters" : "No skills"}
        emptyDescription={
          filtersActive
            ? "Try adjusting your search or filter."
            : "Get started by adding a new skill."
        }
        onEdit={(s) => navigate(`/settings/skills/${s.slug}/edit`)}
        onDelete={(s) => {
          setPendingDelete(s);
          setDeleteError(null);
        }}
        columns={[
          {
            key: "title",
            label: "Name",
            render: (s) => (
              <Link to={`/settings/skills/${s.slug}`} className="admin-table-name">
                {s.title}
              </Link>
            ),
          },
          { key: "category", label: "Category", render: (s) => s.category?.name ?? "—" },
          {
            key: "drills",
            label: "Drills",
            render: (s) => {
              if (drillsFailed) return "—";
              return (
                <Link
                  to={`/settings/drills?skill=${s.id}`}
                  state={{ from: "Skills", fromPath: "/settings/skills", skillName: s.title }}
                  className="admin-table-name"
                >
                  {drillCounts.get(s.id) ?? 0}
                </Link>
              );
            },
          },
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
