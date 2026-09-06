import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Skills from './pages/Skills';
import SkillDetail from './pages/SkillDetail';
import Drills from './pages/Drills';
import DrillDetail from './pages/DrillDetail';
import Videos from './pages/Videos';
import Training from './pages/Training';
import TrainingDetail from './pages/TrainingDetail';
import Schedule from './pages/Schedule';
import './App.css';

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="mobile-logo">BVB Project</span>
        <div style={{ width: 24 }} />
      </div>
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26, 26, 26, 0.3)',
            zIndex: 90,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/:id" element={<SkillDetail />} />
          <Route path="/drills" element={<Drills />} />
          <Route path="/drills/:id" element={<DrillDetail />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training/:id" element={<TrainingDetail />} />
          <Route path="/schedule" element={<Schedule />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
