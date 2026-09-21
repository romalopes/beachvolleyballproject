import type { AppSettingRow } from "../../api";

interface CustomSettingsTableProps {
  rows: AppSettingRow[];
  editing: Record<string, string>;
  rowBusy: string | null;
  onEdit: (key: string, value: string) => void;
  onCancelEdit: (key: string) => void;
  onSave: (key: string) => void;
  onDelete: (key: string) => void;
}

/** Key/value table for arbitrary app_settings rows (built-ins excluded). */
export default function CustomSettingsTable({
  rows,
  editing,
  rowBusy,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: CustomSettingsTableProps) {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const draft = editing[row.key];
          const isEditing = draft !== undefined;
          const busy = rowBusy === row.key;
          return (
            <tr key={row.key}>
              <td>
                <code>{row.key}</code>
              </td>
              <td>
                {isEditing ? (
                  <input
                    type="text"
                    aria-label={`Value for ${row.key}`}
                    value={draft}
                    onChange={(e) => onEdit(row.key, e.target.value)}
                    disabled={busy}
                    style={{ width: "100%", maxWidth: 320 }}
                  />
                ) : (
                  row.value
                )}
              </td>
              <td>
                <div style={{ display: "flex", gap: 8 }}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="admin-btn admin-btn-add"
                        disabled={busy}
                        onClick={() => onSave(row.key)}
                      >
                        {busy ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busy}
                        onClick={() => onCancelEdit(row.key)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busy}
                        onClick={() => onEdit(row.key, row.value)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-delete"
                        disabled={busy}
                        onClick={() => onDelete(row.key)}
                      >
                        {busy ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
