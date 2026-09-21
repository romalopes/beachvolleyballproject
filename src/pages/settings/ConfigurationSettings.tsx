import { useEffect, useState } from "react";
import { api, type AppConfiguration, type AppSettingRow } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import CustomSettingsTable from "../../components/settings/CustomSettingsTable";

const DEFAULT_FORM: AppConfiguration = {
  logs_saved_to_database: true,
  test: false,
  test_email: "romalopes@yahoo.com.br",
};

/**
 * Global Configuration page (admin-only, `/settings/configuration`).
 *
 * Two sections:
 *  1. Built-in toggles stored in the backend's app_settings table. Mirrors
 *     the wine words project's Configuration page (`/admin/configuration`):
 *     a "Save logs to database" audit-trail toggle plus the email test-mode
 *     toggle (redirect every outgoing email to the configured test address).
 *  2. A custom-settings table listing every other app_settings row, with
 *     inline value editing plus add/delete for arbitrary new key/value pairs.
 */
export default function ConfigurationSettings() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;
  const [form, setForm] = useState<AppConfiguration>(DEFAULT_FORM);
  const [saved, setSaved] = useState<AppConfiguration | null>(null);
  const [rows, setRows] = useState<AppSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const [data, settings] = await Promise.all([
          api.getConfiguration(),
          api.appSettings(),
        ]);
        if (cancelled) return;
        const next = {
          logs_saved_to_database: data?.logs_saved_to_database !== false,
          test: data?.test === true,
          test_email: data?.test_email ?? "romalopes@yahoo.com.br",
        };
        setForm(next);
        setSaved(next);
        setRows(settings?.settings ?? []);
        setError(null);
        setRowsError(null);
      } catch (err: unknown) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load configuration.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const customRows = rows.filter(
    (row) => !["logs_enabled", "test", "test_email"].includes(row.key),
  );

  const dirty = saved === null || JSON.stringify(form) !== JSON.stringify(saved);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await api.updateConfiguration(form);
      const next = {
        logs_saved_to_database: data?.logs_saved_to_database !== false,
        test: data?.test === true,
        test_email: data?.test_email ?? form.test_email,
      };
      setForm(next);
      setSaved(next);
      setSavedAt(new Date());
      setRows((prev) =>
        prev.map((row) =>
          row.key === "logs_enabled"
            ? { ...row, value: String(next.logs_saved_to_database) }
            : row.key === "test"
              ? { ...row, value: String(next.test) }
              : row.key === "test_email"
                ? { ...row, value: next.test_email }
                : row,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRow(event: React.FormEvent) {
    event.preventDefault();
    const key = newKey.trim();
    if (!key) {
      setRowsError("Key can't be blank.");
      return;
    }
    setAdding(true);
    setRowsError(null);
    try {
      const created = await api.createAppSetting({ key, value: newValue });
      setRows((prev) =>
        [...prev, created].sort((a, b) => a.key.localeCompare(b.key)),
      );
      setNewKey("");
      setNewValue("");
    } catch (err: unknown) {
      setRowsError(
        err instanceof Error ? err.message : "Failed to add setting.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateRow(key: string) {
    setRowBusy(key);
    setRowsError(null);
    try {
      const updated = await api.updateAppSetting(key, editing[key] ?? "");
      setRows((prev) => prev.map((row) => (row.key === key ? updated : row)));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err: unknown) {
      setRowsError(
        err instanceof Error ? err.message : "Failed to update setting.",
      );
    } finally {
      setRowBusy(null);
    }
  }

  async function handleDeleteRow(key: string) {
    if (!window.confirm(`Delete setting "${key}"?`)) return;
    setRowBusy(key);
    setRowsError(null);
    try {
      await api.deleteAppSetting(key);
      setRows((prev) => prev.filter((row) => row.key !== key));
    } catch (err: unknown) {
      setRowsError(
        err instanceof Error ? err.message : "Failed to delete setting.",
      );
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <SettingsLayout
      title="Configuration"
      description="Global application settings. Changes take effect immediately for every user of the system."
      backTo="/settings"
      backLabel="Back to Settings"
    >
      {loading ? (
        <div className="loading">Loading configuration...</div>
      ) : (
        <form onSubmit={handleSave}>
          <h2>Logs</h2>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}
          >
            <input
              type="checkbox"
              checked={form.logs_saved_to_database}
              onChange={(e) =>
                setForm((f) => ({ ...f, logs_saved_to_database: e.target.checked }))
              }
              disabled={saving}
            />
            Save logs to database
          </label>
          <p className="admin-table-name" style={{ fontWeight: "normal" }}>
            When enabled (default), every audited action is persisted to the
            database audit trail shown on the Logs page. When disabled, no new
            database log entries are written — the application log file is
            unaffected.
          </p>

          <h2 style={{ marginTop: 24 }}>Email test mode</h2>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}
          >
            <input
              type="checkbox"
              checked={form.test}
              onChange={(e) => setForm((f) => ({ ...f, test: e.target.checked }))}
              disabled={saving}
            />
            Redirect all emails to the test address
          </label>
          <p className="admin-table-name" style={{ fontWeight: "normal" }}>
            When enabled, every outgoing email is sent to the test address below
            instead of its real recipients, with a [TEST] subject prefix. Use
            this to safely verify email flows without emailing real users.
          </p>
          <label style={{ display: "block", margin: "8px 0" }}>
            Test email address
            <input
              type="email"
              value={form.test_email}
              onChange={(e) => setForm((f) => ({ ...f, test_email: e.target.value }))}
              disabled={saving}
              placeholder="romalopes@yahoo.com.br"
              style={{ display: "block", marginTop: 4, maxWidth: 320, width: "100%" }}
            />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            <button
              type="submit"
              className="admin-btn admin-btn-add"
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            {savedAt && !error && (
              <span className="admin-table-name" style={{ fontWeight: "normal" }}>
                Saved at {savedAt.toLocaleTimeString()}
              </span>
            )}
            {error && (
              <span className="auth-flash auth-flash-error" role="alert">
                {error}
              </span>
            )}
          </div>
        </form>
      )}

      {!loading && (
        <section style={{ marginTop: 32 }}>
          <h2>Custom settings</h2>
          <p className="admin-table-name" style={{ fontWeight: "normal" }}>
            Extra key/value rows in the app_settings table. Add new rows with
            the form below; edit values inline or delete rows you no longer
            need. Built-in keys are managed in the sections above.
          </p>
          <form onSubmit={handleAddRow} style={{ margin: "12px 0" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label>
                Key
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  disabled={adding}
                  placeholder="e.g. maintenance_banner"
                  style={{ display: "block", marginTop: 4, minWidth: 200 }}
                />
              </label>
              <label>
                Value
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  disabled={adding}
                  placeholder="e.g. true"
                  style={{ display: "block", marginTop: 4, minWidth: 200 }}
                />
              </label>
              <div style={{ alignSelf: "flex-end" }}>
                <button
                  type="submit"
                  className="admin-btn admin-btn-add"
                  disabled={adding || !newKey.trim()}
                >
                  {adding ? "Adding..." : "Add setting"}
                </button>
              </div>
            </div>
          </form>
          {rowsError && (
            <span className="auth-flash auth-flash-error" role="alert">
              {rowsError}
            </span>
          )}
          {customRows.length === 0 ? (
            <p className="admin-table-name" style={{ fontWeight: "normal" }}>
              No custom settings yet. Use the form above to add the first row.
            </p>
          ) : (
            <CustomSettingsTable
              rows={customRows}
              editing={editing}
              rowBusy={rowBusy}
              onEdit={(key, value) =>
                setEditing((prev) => ({ ...prev, [key]: value }))
              }
              onCancelEdit={(key) =>
                setEditing((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                })
              }
              onSave={handleUpdateRow}
              onDelete={handleDeleteRow}
            />
          )}
        </section>
      )}
    </SettingsLayout>
  );
}
