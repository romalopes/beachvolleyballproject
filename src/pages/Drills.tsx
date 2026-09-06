import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Drill } from '../api';
import PageHeader from '../components/PageHeader';
import DrillCard from '../components/DrillCard';
import EmptyState from '../components/EmptyState';
import { Search } from 'lucide-react';

const difficulties = ['beginner', 'intermediate', 'advanced'];

export default function Drills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.drills()
      .then(setDrills)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDrills = drills.filter((drill) => {
    const matchesSearch = drill.title.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty =
      selectedDifficulty === 'all' || drill.difficulty_level === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Drills"
        description="Search and filter drills by difficulty and player count. Each drill develops specific skills."
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
        {difficulties.map((level) => (
          <button
            key={level}
            className={`filter-btn${selectedDifficulty === level ? ' active' : ''}`}
            onClick={() => setSelectedDifficulty(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
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
