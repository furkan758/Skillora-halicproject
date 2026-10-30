import { Check, X } from "lucide-react";

export default function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="toast" role="status">
      <span>
        <Check size={17} />
      </span>
      {message}
      <button aria-label="Dismiss message" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
