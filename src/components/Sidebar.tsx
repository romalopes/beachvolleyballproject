import { NavLink } from "react-router-dom";
import {
  Home,
  Target,
  Dumbbell,
  PlayCircle,
  CalendarDays,
  ClipboardList,
  LogOut,
  LogIn,
  UserCircle,
  Settings,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/skills", label: "Skills", icon: Target },
  { path: "/drills", label: "Drills", icon: Dumbbell },
  { path: "/videos", label: "Videos", icon: PlayCircle },
  { path: "/training", label: "Training", icon: ClipboardList },
  { path: "/schedule", label: "Schedule", icon: CalendarDays },
];

export default function Sidebar() {
  const { user, logout, impersonation, stopImpersonating } = useAuth();

  return (
    <>
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">
          <img src="/ball.png" width="24" height="24" alt="" />
        </span>
        <NavLink to="/" className="logo-text">
          BVB Project - React
        </NavLink>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Icon />
              {item.label}
            </NavLink>
          );
        })}
        {user?.roles?.includes("admin") && (
          <>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Settings />
              Settings
            </NavLink>
            {/* <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <Shield />
              Admin
            </NavLink> */}
          </>
        )}
        {user && (
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <UserCircle />
            Account
          </NavLink>
        )}
      </nav>
      <div className="sidebar-footer">
        Beach Volleyball Skills Database
        <br />
        Organise. Understand. Train.
      </div>
      {impersonation.active && impersonation.realAdmin && (
        <div className="sidebar-impersonation">
          <div className="sidebar-impersonation-title">Acting as {user?.name || user?.email_address}</div>
          <div className="sidebar-impersonation-sub">Return to your admin account</div>
          <button
            type="button"
            className="sidebar-impersonation-btn"
            onClick={(e) => {
              e.preventDefault();
              stopImpersonating();
            }}
          >
            Return to Admin
          </button>
        </div>
      )}
      <div className="sidebar-user">
        {user ? (
          <>
            <span className="sidebar-user-email" title={user.email_address}>
              {user.name || user.email_address}
            </span>
            <span className="sidebar-user-roles">
              {user.roles?.map((role) => (
                <span key={role} className="role-badge">
                  {role}
                </span>
              ))}
            </span>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              <LogOut size={14} />
              Sign out
            </a>
          </>
        ) : (
          <NavLink to="/login" className="sidebar-login">
            <LogIn size={14} />
            Sign in
          </NavLink>
        )}
      </div>
    </>
  );
}
