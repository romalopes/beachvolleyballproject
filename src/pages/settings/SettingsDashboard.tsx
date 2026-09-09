import { Link } from "react-router-dom";
import { Target, Tags, Dumbbell } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";

const RESOURCES = [
  { to: "/settings/skills", label: "Skills", desc: "Manage skills taught in drills.", icon: Target },
  { to: "/settings/categories", label: "Categories", desc: "Manage skill categories.", icon: Tags },
  { to: "/settings/drills", label: "Drills", desc: "Manage drills and their attributes.", icon: Dumbbell },
];

export default function SettingsDashboard() {
  const { user } = useAuth();
  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Settings"
      description="Manage application data. Only admins can access these pages."
    >
      <div className="settings-grid">
        {RESOURCES.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.to} to={r.to} className="settings-card">
              <span className="settings-card-icon">
                <Icon size={20} />
              </span>
              <span className="settings-card-title">{r.label}</span>
              <span className="settings-card-desc">{r.desc}</span>
            </Link>
          );
        })}
      </div>
    </SettingsLayout>
  );
}
