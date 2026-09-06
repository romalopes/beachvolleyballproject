import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Category, type Skill } from '../api';
import PageHeader from '../components/PageHeader';
import SkillCard from '../components/SkillCard';
import EmptyState from '../components/EmptyState';
import { Search } from 'lucide-react';

export default function Skills() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      selectedCategory === 'all' || skill.category?.name === selectedCategory;
    const matchesSearch = skill.title.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
          className={`filter-btn${selectedCategory === 'all' ? ' active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-btn${selectedCategory === cat.name ? ' active' : ''}`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredSkills.length === 0 ? (
        <EmptyState title="No skills found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => navigate(`/skills/${skill.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
