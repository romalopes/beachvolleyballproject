import { NavLink } from 'react-router-dom';
import {
  Home,
  Target,
  Dumbbell,
  PlayCircle,
  CalendarDays,
  ClipboardList,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/skills', label: 'Skills', icon: Target },
  { path: '/drills', label: 'Drills', icon: Dumbbell },
  { path: '/videos', label: 'Videos', icon: PlayCircle },
  { path: '/training', label: 'Training', icon: ClipboardList },
  { path: '/schedule', label: 'Schedule', icon: CalendarDays },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <>
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20" />
            <path d="M2 12h20" />
          </svg>
        </span>
        BVB Project
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              <Icon />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        Beach Volleyball Skills Database
        <br />
        Organise. Understand. Train.
      </div>
      <div className="sidebar-user">
        {user ? (
          <>
            <span className="sidebar-user-email" title={user.email_address}>
              {user.email_address}
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
