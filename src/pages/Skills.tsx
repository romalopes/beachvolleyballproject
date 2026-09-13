import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Category, type Skill } from "../api";
import PageHeader from "../components/PageHeader";
import SkillCard from "../components/SkillCard";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/settings/Pagination";
import { Search, X } from "lucide-react";

const ITEMS_PER_SECTION = 9;
const ITEMS_PER_PAGE = 20;

export default function Skills() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal state for "Show all"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    Promise.all([api.categories(), api.skills()])
      .then(([cats, sks]) => {
        setCategories(cats);
        setSkills(sks);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const matchesCategory =
      selectedCategory === "all" || skill.category?.name === selectedCategory;
    const matchesSearch = skill.title
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped = new Map<string, Skill[]>();
    filteredSkills.forEach((skill) => {
      const categoryName = skill.category?.name ?? "Uncategorized";
      if (!grouped.has(categoryName)) grouped.set(categoryName, []);
      grouped.get(categoryName)!.push(skill);
    });
    // Sort categories alphabetically
    return new Map(
      [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    );
  }, [filteredSkills]);

  // Get skills for modal
  const modalSkills = useMemo(() => {
    if (!modalCategory) return [];
    return skillsByCategory.get(modalCategory) ?? [];
  }, [modalCategory, skillsByCategory]);

  const modalTotalPages = Math.ceil(modalSkills.length / ITEMS_PER_PAGE);
  const modalPaginatedSkills = modalSkills.slice(
    (modalPage - 1) * ITEMS_PER_PAGE,
    modalPage * ITEMS_PER_PAGE,
  );

  const openModal = (category: string) => {
    setModalCategory(category);
    setModalPage(1);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalCategory(null);
    setModalPage(1);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Skills"
        description="Browse all beach volleyball skills organised by category. Click a skill to see details and related drills."
      />

      <div className="search-bar">
        <span className="search-bar-icon">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${selectedCategory === "all" ? " active" : ""}`}
          onClick={() => setSelectedCategory("all")}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-btn${selectedCategory === cat.name ? " active" : ""}`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredSkills.length === 0 ? (
        <EmptyState
          title="No skills found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="skills-by-category">
          {[...skillsByCategory.entries()].map(
            ([categoryName, categorySkills]) => (
              <section key={categoryName} className="category-section">
                <div className="category-section-header">
                  <h2 className="category-section-title">{categoryName}</h2>
                  <span className="category-section-count">
                    {categorySkills.length}{" "}
                    {categorySkills.length === 1 ? "skill" : "skills"}
                  </span>
                </div>
                <div className="grid">
                  {categorySkills.slice(0, ITEMS_PER_SECTION).map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onClick={() => navigate(`/skills/${skill.slug}`)}
                    />
                  ))}
                </div>
                {categorySkills.length > ITEMS_PER_SECTION && (
                  <button
                    className="show-all-link"
                    onClick={() => openModal(categoryName)}
                  >
                    Show all {categorySkills.length} skills
                  </button>
                )}
              </section>
            ),
          )}
        </div>
      )}

      {/* Modal for showing all skills in a category */}
      {modalOpen && modalCategory && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalCategory}</h2>
              <button
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid">
                {modalPaginatedSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onClick={() => {
                      closeModal();
                      navigate(`/skills/${skill.slug}`);
                    }}
                  />
                ))}
              </div>
              {modalTotalPages > 1 && (
                <Pagination
                  currentPage={modalPage}
                  totalPages={modalTotalPages}
                  totalItems={modalSkills.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setModalPage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
