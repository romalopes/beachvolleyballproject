interface TrainingFormActionsProps {
  saving: boolean;
  isNew: boolean;
  onCancel: () => void;
}

/**
 * Save/Cancel action row for the training form. Extracted so the markup for
 * the submit + cancel buttons lives in exactly one place instead of being
 * copy-pasted wherever the form needs its actions.
 */
export default function TrainingFormActions({
  saving,
  isNew,
  onCancel,
}: TrainingFormActionsProps) {
  return (
    <div className="admin-form-actions">
      <button
        type="submit"
        className="admin-btn admin-btn-add"
        disabled={saving}
      >
        {saving ? "Saving..." : isNew ? "Create Training" : "Save Changes"}
      </button>
      <button type="button" className="admin-btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
