import { useEffect, useState } from 'react';
import { api, type Category, type Skill, type Drill } from '../api';

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
        <a href="/skills" className="home-section-card">
          <h3>Skills</h3>
          <p>Browse all beach volleyball skills organised by category. Each skill includes descriptions and related drills.</p>
          <span className="home-section-link">Explore Skills</span>
        </a>
        <a href="/drills" className="home-section-card">
          <h3>Drills</h3>
          <p>Search and filter drills by difficulty and player count. Each drill links to the skills it develops.</p>
          <span className="home-section-link">Explore Drills</span>
        </a>
        <a href="/videos" className="home-section-card">
          <h3>Videos</h3>
          <p>Watch skill demonstrations, drill walkthroughs, and training footage from the video library.</p>
          <span className="home-section-link">Explore Videos</span>
        </a>
        <a href="/training" className="home-section-card">
          <h3>Training</h3>
          <p>View training sessions that combine multiple drills and skills into structured practice plans.</p>
          <span className="home-section-link">Explore Training</span>
        </a>
        <a href="/schedule" className="home-section-card">
          <h3>Schedule</h3>
          <p>See upcoming training sessions and plan your practice calendar.</p>
          <span className="home-section-link">View Schedule</span>
        </a>
      </section>
    </div>
  );
}
