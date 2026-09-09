import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Category, type Skill, type Drill } from '../api';
import { ArrowRight, Target, Dumbbell, PlayCircle, ClipboardList, CalendarDays } from 'lucide-react';

const sections = [
  { title: 'Skills', path: '/skills', icon: Target, description: 'Browse all beach volleyball skills organised by category. Each skill includes descriptions and related drills.' },
  { title: 'Drills', path: '/drills', icon: Dumbbell, description: 'Search and filter drills by difficulty, training stage, and player range. Each drill links to the skills it develops.' },
  { title: 'Videos', path: '/videos', icon: PlayCircle, description: 'Watch skill demonstrations, drill walkthroughs, and training footage from the video library.' },
  { title: 'Training', path: '/training', icon: ClipboardList, description: 'View training sessions that combine multiple drills and skills into structured practice plans.' },
  { title: 'Schedule', path: '/schedule', icon: CalendarDays, description: 'See upcoming training sessions and plan your practice calendar.' },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.categories(), api.skills(), api.drills()])
      .then(([cats, sks, drs]) => {
        setCategories(cats);
        setSkills(sks);
        setDrills(drs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <section className="home-hero">
        <div className="home-hero-badge">
          <Target size={14} />
          Beach Volleyball Knowledge System
        </div>
        <h1>BEACH VOLLEYBALL PROJECT</h1>
        <p className="home-hero-tagline">
          Organise the skills. Understand the game. Train with purpose.
        </p>
      </section>

      <section className="home-stats">
        <div className="home-stat">
          <span className="home-stat-value">{categories.length}</span>
          <span className="home-stat-label">Categories</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-value">{skills.length}</span>
          <span className="home-stat-label">Skills</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-value">{drills.length}</span>
          <span className="home-stat-label">Drills</span>
        </div>
      </section>

      <section className="home-sections">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.path} to={section.path} className="home-section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Icon size={20} color="var(--amber-600)" />
                <h3>{section.title}</h3>
              </div>
              <p>{section.description}</p>
              <span className="home-section-link">
                Explore {section.title} <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
