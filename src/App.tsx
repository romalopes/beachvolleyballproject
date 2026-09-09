import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/AuthContext";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Skills from "./pages/Skills";
import SkillDetail from "./pages/SkillDetail";
import Drills from "./pages/Drills";
import DrillDetail from "./pages/DrillDetail";
import Videos from "./pages/Videos";
import Training from "./pages/Training";
import TrainingDetail from "./pages/TrainingDetail";
import Schedule from "./pages/Schedule";
import AdminUsers from "./pages/AdminUsers";
import SettingsDashboard from "./pages/settings/SettingsDashboard";
import SkillsSettings from "./pages/settings/Skills";
import SkillDetailSettings from "./pages/settings/SkillDetail";
import SkillFormPage from "./pages/settings/SkillFormPage";
import CategoriesSettings from "./pages/settings/Categories";
import CategoryDetailSettings from "./pages/settings/CategoryDetail";
import CategoryFormPage from "./pages/settings/CategoryFormPage";
import DrillsSettings from "./pages/settings/Drills";
import DrillDetailSettings from "./pages/settings/DrillDetail";
import DrillFormPage from "./pages/settings/DrillFormPage";
import AccountPage from "./pages/Account";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import "./App.css";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const isAdmin = user?.roles?.includes("admin");
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <div className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="mobile-logo">BVB Project - React</span>
        <div style={{ width: 24 }} />
      </div>
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div
          className="sidebar-overlay open"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Home />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/skills/:id" element={<SkillDetail />} />
            <Route path="/drills" element={<Drills />} />
            <Route path="/drills/:id" element={<DrillDetail />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/training" element={<Training />} />
            <Route path="/training/:id" element={<TrainingDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <SettingsDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/skills"
              element={
                <AdminRoute>
                  <SkillsSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/skills/new"
              element={
                <AdminRoute>
                  <SkillFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/skills/:id/edit"
              element={
                <AdminRoute>
                  <SkillFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/skills/:id"
              element={
                <AdminRoute>
                  <SkillDetailSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/categories"
              element={
                <AdminRoute>
                  <CategoriesSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/categories/new"
              element={
                <AdminRoute>
                  <CategoryFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/categories/:id/edit"
              element={
                <AdminRoute>
                  <CategoryFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/categories/:id"
              element={
                <AdminRoute>
                  <CategoryDetailSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/drills"
              element={
                <AdminRoute>
                  <DrillsSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/drills/new"
              element={
                <AdminRoute>
                  <DrillFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/drills/:id/edit"
              element={
                <AdminRoute>
                  <DrillFormPage />
                </AdminRoute>
              }
            />
            <Route
              path="/settings/drills/:id"
              element={
                <AdminRoute>
                  <DrillDetailSettings />
                </AdminRoute>
              }
            />
            <Route path="/account" element={<AccountPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
