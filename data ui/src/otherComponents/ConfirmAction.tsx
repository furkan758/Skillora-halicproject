import { LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import Dialog from "./Dialog";
import { apiError } from "./errors";
export default function ConfirmAction({
  title,
  children,
  label,
  onConfirm,
  onClose,
  permanent = false,
}: {
  title: string;
  children: ReactNode;
  label: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  permanent?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false);
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setError(apiError(error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="catalog-delete">
        {children}
        {permanent && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={busy}
            />
            <span>
              I understand this permanently deletes this scenario and its team
              selections.
            </span>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={busy || (permanent && !ack)}
            onClick={confirm}
          >
            {busy && <LoaderCircle size={16} className="spin" />}
            {label}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
