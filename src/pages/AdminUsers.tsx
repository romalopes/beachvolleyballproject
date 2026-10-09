import { useEffect, useState } from "react";
import { api, type AdminUser, type PaginationMeta } from "../api";
import { useAuth } from "../auth/AuthContext";
import AdminUserRoleControls from "../components/AdminUserRoleControls";
import Pagination from "../components/settings/Pagination";

const PER_PAGE = 20;

export default function AdminUsers() {
  const { user } = useAuth();
  const isAdmin =
    user?.roles?.includes("admin") &&
    !(user as { real_admin?: unknown }).real_admin;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Which query the rows on screen belong to. While a newer query is in flight
  // the keys differ, so `loading` is derived from them instead of being synced
  // by an effect (which would cascade a second render on every change).
  const queryKey = `${page}|${search}|${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = isAdmin && loadedKey !== queryKey;

  // The query the effect below re-runs on: `page`/`search` define it, and
  // bumping `refreshKey` is the manual "reload" trigger (Refresh, role change).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .adminUsers({ page, per_page: PER_PAGE, search: search || undefined })
      .then((response) => {
        if (cancelled) return;
        setUsers(response.data);
        setMeta(response.meta);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load users.");
      })
      .finally(() => {
        if (cancelled) return;
        // Either way this query has been answered: stop showing the loading state.
        setLoadedKey(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, page, search, refreshKey, queryKey]);

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPage(1);
    setSearch(searchDraft.trim());
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

      <form
        onSubmit={applySearch}
        style={{ margin: "0 0 16px", display: "flex", gap: 8, maxWidth: 480 }}
      >
        <div style={{ flex: 1 }}>
          <label
            htmlFor="users-search"
            className="admin-table-name"
            style={{ display: "block", fontWeight: "normal" }}
          >
            Search by name or email
          </label>
          <input
            id="users-search"
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="e.g. Anderson or test.beachvolleyballhub.com"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="submit"
            className="admin-btn admin-btn-add"
            disabled={loading}
          >
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
            <AdminUserRoleControls
              key={u.id}
              adminUser={u}
              onError={(message) => setError(message || null)}
              onRoleChange={() => {
                setLoadedKey(null);
                setRefreshKey((k) => k + 1);
              }}
              onDelete={() => {
                setLoadedKey(null);
                setRefreshKey((k) => k + 1);
              }}
            />
          ))}
        </div>
      )}

      {meta && (
        <Pagination
          currentPage={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total}
          itemsPerPage={PER_PAGE}
          onPageChange={(next) => {
            if (next === page) return;
            setError(null);
            setPage(next);
          }}
        />
      )}

      <button
        type="button"
        className="admin-btn admin-btn-add"
        onClick={() => {
          setError(null);
          setPage(1);
          setRefreshKey((k) => k + 1);
        }}
        disabled={loading}
      >
        Refresh
      </button>
    </div>
  );
}
