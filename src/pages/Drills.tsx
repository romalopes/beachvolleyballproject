import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Drill } from '../api';
import PageHeader from '../components/PageHeader';
import DrillCard from '../components/DrillCard';
import EmptyState from '../components/EmptyState';

export default function Drills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.drills()
      .then(setDrills)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDrills = drills.filter((drill) =>
    drill.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <PageHeader
        title="Drills"
        description="Search and filter drills by difficulty and player count. Each drill develops specific skills."
      />

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search drills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredDrills.length === 0 ? (
        <EmptyState title="No drills found" description="Try adjusting your search." />
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
