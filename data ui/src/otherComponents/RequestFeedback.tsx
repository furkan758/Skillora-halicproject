import { LoaderCircle } from "lucide-react";
import type { RequestStatus } from "../types";
export default function RequestFeedback({
  status,
  error,
  onRetry,
}: {
  status: RequestStatus;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (status === "loading")
    return (
      <div className="loading-state" role="status">
        <LoaderCircle className="spin" size={18} /> Loading...
      </div>
    );
  if (status !== "failed") return null;
  return (
    <div className="empty-state">
      <p className="error" role="alert">
        {error}
      </p>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
