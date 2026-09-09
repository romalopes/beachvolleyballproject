import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Drill } from '../api';
import PageHeader from '../components/PageHeader';
import DrillCard from '../components/DrillCard';
import EmptyState from '../components/EmptyState';
import { Search } from 'lucide-react';
import {
  DIFFICULTY_LEVELS,
  TRAINING_STAGES,
  isValidDrillRange,
} from '../utils/drills';

export default function Drills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [playerFilter, setPlayerFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.drills()
      .then((rows) => {
        if (import.meta.env.DEV) {
          rows.forEach((drill) => {
            if (!isValidDrillRange(drill)) {
              console.warn('Invalid drill payload skipped:', drill);
            }
          });
        }
        setDrills(rows.filter(isValidDrillRange));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const playerCount = playerFilter.trim() === '' ? null : Number(playerFilter.trim());

  const filteredDrills = drills.filter((drill) => {
    const matchesSearch = drill.title.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty =
      selectedDifficulty === 'all' || drill.difficulty_level === selectedDifficulty;
    const matchesStage =
      selectedStage === 'all' || drill.training_stage === selectedStage;
    const matchesPlayers =
      playerCount === null ||
      Number.isNaN(playerCount) ||
      (drill.min_players <= playerCount && playerCount <= drill.max_players);
    return matchesSearch && matchesDifficulty && matchesStage && matchesPlayers;
  });

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
          className={`filter-btn${selectedDifficulty === 'all' ? ' active' : ''}`}
          onClick={() => setSelectedDifficulty('all')}
        >
          All Levels
        </button>
        {DIFFICULTY_LEVELS.map((level) => (
          <button
            key={level.value}
            className={`filter-btn${selectedDifficulty === level.value ? ' active' : ''}`}
            onClick={() => setSelectedDifficulty(level.value)}
          >
            {level.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${selectedStage === 'all' ? ' active' : ''}`}
          onClick={() => setSelectedStage('all')}
        >
          All Stages
        </button>
        {TRAINING_STAGES.map((stage) => (
          <button
            key={stage.value}
            className={`filter-btn${selectedStage === stage.value ? ' active' : ''}`}
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
        <EmptyState title="No drills found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid">
          {filteredDrills.map((drill) => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onClick={() => navigate(`/drills/${drill.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
