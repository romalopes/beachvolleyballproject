import { useEffect, useState } from "react";
import { api, type AdminUser, type PaginationMeta } from "../api";
import { useAuth } from "../auth/AuthContext";
import Pagination from "../components/settings/Pagination";

const PER_PAGE = 20;

export default function AdminUsers() {
  const { user, startImpersonating } = useAuth();
  const isAdmin = user?.roles?.includes("admin") && !(user as { real_admin?: unknown }).real_admin;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [actingBusy, setActingBusy] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isAdmin) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page, search]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.adminUsers({ page, per_page: PER_PAGE, search: search || undefined });
      setUsers(response.data);
      setMeta(response.meta);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
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

      <form onSubmit={applySearch} style={{ margin: "0 0 16px", display: "flex", gap: 8, maxWidth: 480 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="users-search" className="admin-table-name" style={{ display: "block", fontWeight: "normal" }}>
            Search by name or email
          </label>
          <input
            id="users-search"
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="e.g. Anderson or romalopes@yahoo.com.br"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button type="submit" className="admin-btn admin-btn-add" disabled={loading}>
            Search
          </button>
        </div>
      </form>

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
                {(["guest", "player", "coach", "curator", "admin"] as const).map((role) => {
                    const present = hasRole(u, role);
                    const isOwnAdminRole =
                      role === "admin" && u.id === user?.id;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={
                          present
                            ? "admin-btn admin-btn-remove"
                            : "admin-btn admin-btn-add"
                        }
                        disabled={busy[u.id] || isOwnAdminRole}
                        title={
                          isOwnAdminRole
                            ? "You cannot remove your own admin role"
                            : undefined
                        }
                        onClick={() => toggleRole(u, role)}
                      >
                        {present ? `Remove ${role}` : `Add ${role}`}
                      </button>
                    );
                  })}
                {isAdmin && !hasRole(u, "admin") && u.id !== user?.id && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-add"
                    disabled={actingBusy[u.id]}
                    onClick={async () => {
                      if (!window.confirm(`Act as ${u.name || u.email_address}? You will operate the app as that user until you return.`)) return;
                      setActingBusy((prev) => ({ ...prev, [u.id]: true }));
                      try {
                        await startImpersonating(u.id);
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setActingBusy((prev) => ({ ...prev, [u.id]: false }));
                      }
                    }}
                  >
                    Act as User
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}

      <button
        type="button"
        className="admin-btn admin-btn-add"
        onClick={() => {
          setPage(1);
          loadUsers();
        }}
        disabled={loading}
      >
        Refresh
      </button>
    </div>
  );
}
