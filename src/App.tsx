import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
  return (
    <div className="app">
      <Sidebar />
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
