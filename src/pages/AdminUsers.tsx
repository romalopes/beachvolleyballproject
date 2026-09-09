import { useEffect, useState } from "react";
import { api, type AdminUser } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function AdminUsers() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.adminUsers());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (u: AdminUser, role: string) =>
    u.roles.some((r) => r.name === role);

  const toggleRole = async (u: AdminUser, role: string) => {
    const present = hasRole(u, role);
    setBusy((prev) => ({ ...prev, [u.id]: true }));
    try {
      if (present) await api.adminRemoveRole(u.id, role);
      else await api.adminAddRole(u.id, role);
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy((prev) => ({ ...prev, [u.id]: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Users</h1>
        <p>Manage roles for every account in the system.</p>
      </header>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}

      {loading ? (
        <p>Loading users…</p>
      ) : !users ? (
        <p>No users found.</p>
      ) : (
        <div className="admin-users">
          {users.map((u) => (
            <div key={u.id} className="admin-user-card">
              <div className="admin-user-info">
                <span className="admin-user-name">
                  {u.name || u.email_address}
                </span>
                <span className="admin-user-email">{u.email_address}</span>
              </div>
              <div className="admin-user-roles">
                {u.roles.map((r) => (
                  <span key={r.id} className="role-badge">
                    {r.name}
                  </span>
                ))}
              </div>
              <div className="admin-user-actions">
                {(["guest", "player", "coach", "admin"] as const).map((role) => {
                  const present = hasRole(u, role);
                  return (
                    <button
                      key={role}
                      type="button"
                      className={
                        present
                          ? "admin-btn admin-btn-remove"
                          : "admin-btn admin-btn-add"
                      }
                      disabled={busy[u.id]}
                      onClick={() => toggleRole(u, role)}
                    >
                      {present ? `Remove ${role}` : `Add ${role}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="admin-btn admin-btn-add"
        onClick={loadUsers}
        disabled={loading}
      >
        Refresh
      </button>
    </div>
  );
}
