import { AlertTriangle } from "lucide-react";

interface DeleteConfirmProps {
  entityName: string;
  warning?: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}

export default function DeleteConfirm({
  entityName,
  warning,
  onCancel,
  onConfirm,
  deleting,
  error,
}: DeleteConfirmProps) {
  return (
    <div className="delete-confirm" role="alertdialog" aria-label={`Delete ${entityName}`}>
      <div className="delete-confirm-header">
        <AlertTriangle size={18} />
        <strong>Delete &ldquo;{entityName}&rdquo;?</strong>
      </div>
      <p>{warning ?? "This action cannot be undone."}</p>
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <div className="delete-confirm-actions">
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={deleting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-remove"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
