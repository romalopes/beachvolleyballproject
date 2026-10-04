import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Home,
  Layers,
  LogIn,
  LogOut,
  Network,
  PlayCircle,
  Settings,
  ShieldOff,
  Star,
  Target,
  Trophy,
  UserCircle,
  Users,
  UsersRound,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTestAccess } from "../auth/TestAccessContext";

type SidebarLink = {
  path: string;
  label: string;
  icon: LucideIcon;
};

/**
 * A collapsible section of the navigation.
 *
 * `staffOnly` groups hold the people-facing pages: their payloads carry contact
 * details and their endpoints require a training manager (coach/curator/admin),
 * so the links only appear for those roles instead of leading to a 403.
 * `adminOnly` groups hold admin surfaces, which the router guards as well.
 */
type SidebarGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: SidebarLink[];
  staffOnly?: boolean;
  adminOnly?: boolean;
};

/**
 * Home is the one destination that needs no heading: a group holding a single
 * link would only add a click between the user and the page.
 */
const homeLink: SidebarLink = { path: "/", label: "Home", icon: Home };

const navGroups: SidebarGroup[] = [
  {
    id: "development",
    label: "Development",
    icon: GraduationCap,
    items: [
      { path: "/skills", label: "Skills", icon: Target },
      { path: "/drills", label: "Drills", icon: Dumbbell },
      { path: "/videos", label: "Videos", icon: PlayCircle },
      { path: "/training", label: "Training", icon: ClipboardList },
      { path: "/calendar", label: "Calendar", icon: CalendarDays },
      { path: "/schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: Network,
    staffOnly: true,
    items: [
      { path: "/players", label: "Players", icon: Users },
      { path: "/coaches", label: "Coaches", icon: Volleyball },
      // People are the identity behind players and coaches, and are managed
      // separately: a club records committee members and parents who have no
      // profile at all, so a roster cannot be the only way a person arrives.
      { path: "/people", label: "People", icon: UserCircle },
      { path: "/organisations", label: "Organisations", icon: Building2 },
      { path: "/groups", label: "Groups", icon: UsersRound },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    icon: Layers,
    staffOnly: true,
    items: [
      { path: "/assessments", label: "Assessments", icon: Star },
      {
        path: "/assessment-sessions",
        label: "Assessment sessions",
        icon: CalendarDays,
      },
      {
        path: "/ranking-consolidations",
        label: "Ranking consolidations",
        icon: Trophy,
      },
      {
        path: "/assessment-definitions",
        label: "Assessment definitions",
        icon: ClipboardList,
      },
    ],
  },
];

// Settings and Account are destinations rather than sections, so they stay flat
// below the groups instead of becoming one-item accordions that would hide
// their only link when folded.
const settingsLink: SidebarLink = {
  path: "/settings",
  label: "Settings",
  icon: Settings,
};
const accountLink: SidebarLink = {
  path: "/account",
  label: "Account",
  icon: UserCircle,
};
const identityLink: SidebarLink = {
  path: "/identity",
  label: "Identity",
  icon: UsersRound,
};

/**
 * Remembers which groups were folded away. Storage can be unavailable (private
 * mode) or hold something we did not write, and neither case may cost the user
 * their navigation, so every failure falls back to the expanded default.
 */
const STORAGE_KEY = "bvb.sidebar.collapsed-groups";

type CollapsedGroups = Record<string, boolean>;

function readCollapsedGroups(): CollapsedGroups {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const collapsed: CollapsedGroups = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") collapsed[id] = value;
    }
    return collapsed;
  } catch {
    return {};
  }
}

function writeCollapsedGroups(collapsed: CollapsedGroups) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // Remembering the fold is a convenience, never a requirement.
  }
}

/** Mirrors NavLink's own matching so a group can show it holds the page. */
function isPathActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarNavLink({ link }: { link: SidebarLink }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.path}
      end={link.path === "/"}
      className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
    >
      <Icon />
      {link.label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, impersonation, stopImpersonating } = useAuth();
  const { exit: exitTestAccess } = useTestAccess();
  const navigate = useNavigate();
  // The current path decides which group is marked as holding the open page.
  const { pathname } = useLocation();
  const isStaff = Boolean(
    user?.roles?.some(
      (role) => role === "coach" || role === "curator" || role === "admin",
    ),
  );
  const isAdmin = Boolean(user?.roles?.includes("admin"));
  const [collapsedGroups, setCollapsedGroups] =
    useState<CollapsedGroups>(readCollapsedGroups);

  const toggleGroup = (id: string, isCollapsed: boolean) => {
    setCollapsedGroups((previous) => {
      const next = { ...previous, [id]: !isCollapsed };
      writeCollapsedGroups(next);
      return next;
    });
  };

  // A group is left out entirely while none of its pages are reachable, so a
  // player never sees a heading that would only open a 403.
  const visibleGroups = navGroups.filter((group) => {
    if (group.adminOnly) return isAdmin;
    if (group.staffOnly) return isStaff;
    return true;
  });

  return (
    <>
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">
          <img src="/ball.png" width="24" height="24" alt="" />
        </span>
        <NavLink to="/" className="logo-text">
          BVB Project
        </NavLink>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        <SidebarNavLink link={homeLink} />
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isCollapsed = collapsedGroups[group.id] === true;
          const panelId = `sidebar-group-${group.id}`;
          const holdsCurrentPage = group.items.some((item) =>
            isPathActive(pathname, item.path),
          );

          return (
            <div className="sidebar-group" key={group.id}>
              <button
                type="button"
                className={`sidebar-group-toggle${holdsCurrentPage ? " active" : ""}`}
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                onClick={() => toggleGroup(group.id, isCollapsed)}
              >
                <GroupIcon />
                <span className="sidebar-group-label">{group.label}</span>
                <ChevronDown
                  className={`sidebar-group-chevron${isCollapsed ? " collapsed" : ""}`}
                />
              </button>
              {/* Kept in the DOM while folded so `aria-controls` still resolves;
                  the attribute hides it from sight and from assistive tech. */}
              <div
                id={panelId}
                className="sidebar-group-items"
                hidden={isCollapsed}
              >
                {group.items.map((item) => (
                  <SidebarNavLink key={item.path} link={item} />
                ))}
              </div>
            </div>
          );
        })}
        {isAdmin && <SidebarNavLink link={settingsLink} />}
        {user && <SidebarNavLink link={identityLink} />}
        {user && <SidebarNavLink link={accountLink} />}
      </nav>
      <div className="sidebar-footer">
        Beach Volleyball Skills Database
        <br />
        Organise. Understand. Train.
      </div>
      <div className="sidebar-test-access">
        <button
          type="button"
          className="test-access-exit"
          onClick={() => {
            exitTestAccess();
            navigate("/test-access");
          }}
          title="Clear private test access"
        >
          <ShieldOff size={14} />
          Exit Test Mode
        </button>
      </div>
      {impersonation.active && impersonation.realAdmin && (
        <div className="sidebar-impersonation">
          <div className="sidebar-impersonation-title">
            Acting as {user?.name || user?.email_address}
          </div>
          <div className="sidebar-impersonation-sub">
            Return to your admin account
          </div>
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
