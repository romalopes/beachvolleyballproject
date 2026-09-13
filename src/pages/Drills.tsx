import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Drill, type Skill } from "../api";
import PageHeader from "../components/PageHeader";
import DrillCard from "../components/DrillCard";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/settings/Pagination";
import { Search, X } from "lucide-react";
import {
  DIFFICULTY_LEVELS,
  TRAINING_STAGES,
  isValidDrillRange,
} from "../utils/drills";

const ITEMS_PER_SECTION = 9;
const ITEMS_PER_PAGE = 20;

export default function Drills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [playerFilter, setPlayerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal state for "Show all"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSkillId, setModalSkillId] = useState<number | null>(null);
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    Promise.all([api.drills(), api.skills()])
      .then(([drs, sks]) => {
        if (import.meta.env.DEV) {
          drs.forEach((drill) => {
            if (!isValidDrillRange(drill)) {
              console.warn("Invalid drill payload skipped:", drill);
            }
          });
        }
        setDrills(drs.filter(isValidDrillRange));
        setAllSkills(sks);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const playerCount =
    playerFilter.trim() === "" ? null : Number(playerFilter.trim());

  const filteredDrills = drills.filter((drill) => {
    const matchesSearch = drill.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesDifficulty =
      selectedDifficulty === "all" ||
      drill.difficulty_level === selectedDifficulty;
    const matchesStage =
      selectedStage === "all" || drill.training_stage === selectedStage;
    const matchesPlayers =
      playerCount === null ||
      Number.isNaN(playerCount) ||
      (drill.min_players <= playerCount && playerCount <= drill.max_players);
    return matchesSearch && matchesDifficulty && matchesStage && matchesPlayers;
  });

  // Group drills by skill
  const drillsBySkill = useMemo(() => {
    const grouped = new Map<number, { skill: Skill; drills: Drill[] }>();

    filteredDrills.forEach((drill) => {
      drill.skills?.forEach((skill) => {
        if (!grouped.has(skill.id)) {
          grouped.set(skill.id, { skill, drills: [] });
        }
        grouped.get(skill.id)!.drills.push(drill);
      });
    });

    // Sort by skill title alphabetically
    return new Map(
      [...grouped.entries()].sort((a, b) =>
        a[1].skill.title.localeCompare(b[1].skill.title),
      ),
    );
  }, [filteredDrills]);

  // Get drills for modal
  const modalDrills = useMemo(() => {
    if (modalSkillId === null) return [];
    return drillsBySkill.get(modalSkillId)?.drills ?? [];
  }, [modalSkillId, drillsBySkill]);

  const modalSkill = useMemo(() => {
    if (modalSkillId === null) return null;
    return drillsBySkill.get(modalSkillId)?.skill ?? null;
  }, [modalSkillId, drillsBySkill]);

  const modalTotalPages = Math.ceil(modalDrills.length / ITEMS_PER_PAGE);
  const modalPaginatedDrills = modalDrills.slice(
    (modalPage - 1) * ITEMS_PER_PAGE,
    modalPage * ITEMS_PER_PAGE,
  );

  const openModal = (skillId: number) => {
    setModalSkillId(skillId);
    setModalPage(1);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalSkillId(null);
    setModalPage(1);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Drills"
        description="Search and filter drills by difficulty, training stage, and player range. Each drill develops specific skills."
      />

      <div className="search-bar">
        <span className="search-bar-icon">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search drills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${selectedDifficulty === "all" ? " active" : ""}`}
          onClick={() => setSelectedDifficulty("all")}
        >
          All Levels
        </button>
        {DIFFICULTY_LEVELS.map((level) => (
          <button
            key={level.value}
            className={`filter-btn${selectedDifficulty === level.value ? " active" : ""}`}
            onClick={() => setSelectedDifficulty(level.value)}
          >
            {level.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${selectedStage === "all" ? " active" : ""}`}
          onClick={() => setSelectedStage("all")}
        >
          All Stages
        </button>
        {TRAINING_STAGES.map((stage) => (
          <button
            key={stage.value}
            className={`filter-btn${selectedStage === stage.value ? " active" : ""}`}
            onClick={() => setSelectedStage(stage.value)}
          >
            {stage.label}
          </button>
        ))}
        <input
          type="number"
          min={1}
          placeholder="Players"
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          aria-label="Filter by player count"
        />
      </div>

      {filteredDrills.length === 0 ? (
        <EmptyState
          title="No drills found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="drills-by-skill">
          {[...drillsBySkill.entries()].map(
            ([skillId, { skill, drills: skillDrills }]) => (
              <section key={skillId} className="category-section">
                <div className="category-section-header">
                  <h2 className="category-section-title">{skill.title}</h2>
                  <span className="category-section-count">
                    {skillDrills.length}{" "}
                    {skillDrills.length === 1 ? "drill" : "drills"}
                  </span>
                </div>
                <div className="grid">
                  {skillDrills.slice(0, ITEMS_PER_SECTION).map((drill) => (
                    <DrillCard
                      key={drill.id}
                      drill={drill}
                      onClick={() => navigate(`/drills/${drill.slug}`)}
                    />
                  ))}
                </div>
                {skillDrills.length > ITEMS_PER_SECTION && (
                  <button
                    className="show-all-link"
                    onClick={() => openModal(skillId)}
                  >
                    Show all {skillDrills.length} drills
                  </button>
                )}
              </section>
            ),
          )}
        </div>
      )}

      {/* Modal for showing all drills for a skill */}
      {modalOpen && modalSkill && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalSkill.title}</h2>
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
                {modalPaginatedDrills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    onClick={() => {
                      closeModal();
                      navigate(`/drills/${drill.slug}`);
                    }}
                  />
                ))}
              </div>
              {modalTotalPages > 1 && (
                <Pagination
                  currentPage={modalPage}
                  totalPages={modalTotalPages}
                  totalItems={modalDrills.length}
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
