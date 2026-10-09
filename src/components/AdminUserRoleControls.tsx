import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminUser } from "../api";
import { useAuth } from "../auth/AuthContext";

const MANAGED_ROLES = ["guest", "player", "coach", "curator", "admin"] as const;

export function adminUserDisplayName(user: AdminUser) {
  const contactName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return contactName || user.name || user.email_address;
}

interface AdminUserRoleControlsProps {
  adminUser: AdminUser;
  linkName?: boolean;
  onUserChange?: (user: AdminUser) => void;
  onError?: (message: string) => void;
  onRoleChange?: () => void;
  onDelete?: () => void;
}

export default function AdminUserRoleControls({
  adminUser,
  linkName = true,
  onUserChange,
  onError,
  onRoleChange,
  onDelete,
}: AdminUserRoleControlsProps) {
  const { user, startImpersonating } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actingBusy, setActingBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = user?.roles?.includes("admin") && !(user as { real_admin?: unknown })?.real_admin;

  const hasRole = (role: string) => adminUser.roles.some((r) => r.name === role);

  const updateUserRoles = (roleNames: string[]) => {
    const existingByName = new Map(adminUser.roles.map((role) => [role.name, role]));
    const nextRoles = roleNames.map((name) => existingByName.get(name) ?? { id: -1, name });
    onUserChange?.({ ...adminUser, roles: nextRoles });
  };

  const toggleRole = async (role: string) => {
    const present = hasRole(role);
    setBusy(true);
    onError?.("");
    try {
      const response = present
        ? await api.adminRemoveRole(adminUser.id, role)
        : await api.adminAddRole(adminUser.id, role);
      updateUserRoles(response.roles);
      onRoleChange?.();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : "Failed to update the role.");
    } finally {
      setBusy(false);
    }
  };

  const actAsUser = async () => {
    if (!window.confirm(`Act as ${adminUserDisplayName(adminUser)}? You will operate the app as that user until you return.`)) return;
    setActingBusy(true);
    onError?.("");
    try {
      await startImpersonating(adminUser.id);
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : "Failed to start impersonating.");
    } finally {
      setActingBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete user ${adminUserDisplayName(adminUser)} (${adminUser.email_address})? This will also remove their account, address and contact details.`)) return;
    setDeleting(true);
    onError?.("");
    try {
      await api.adminDeleteUser(adminUser.id);
      onDelete?.();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-user-card">
      <div className="admin-user-info">
        {linkName ? (
          <Link className="admin-user-name" to={`/admin/users/${adminUser.id}`}>
            {adminUserDisplayName(adminUser)}
          </Link>
        ) : (
          <span className="admin-user-name">{adminUserDisplayName(adminUser)}</span>
        )}
        <span className="admin-user-email">{adminUser.email_address}</span>
      </div>
      <div className="admin-user-roles">
        {adminUser.roles.map((role) => (
          <span key={`${role.id}-${role.name}`} className="role-badge">
            {role.name}
          </span>
        ))}
      </div>
      <div className="admin-user-actions">
        {MANAGED_ROLES.map((role) => {
          const present = hasRole(role);
          const isOwnAdminRole = role === "admin" && adminUser.id === user?.id;
          return (
            <button
              key={role}
              type="button"
              className={present ? "admin-btn admin-btn-remove" : "admin-btn admin-btn-add"}
              disabled={busy || isOwnAdminRole}
              title={isOwnAdminRole ? "You cannot remove your own admin role" : undefined}
              onClick={() => toggleRole(role)}
            >
              {present ? `Remove ${role}` : `Add ${role}`}
            </button>
          );
        })}
        {isAdmin && !hasRole("admin") && adminUser.id !== user?.id && (
          <button type="button" className="admin-btn admin-btn-add" disabled={actingBusy} onClick={actAsUser}>
            Act as User
          </button>
        )}
        {isAdmin && adminUser.id !== user?.id && (
          <button
            type="button"
            className="admin-btn admin-btn-remove"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete User"}
          </button>
        )}
      </div>
    </div>
  );
}