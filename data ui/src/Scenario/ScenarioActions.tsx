import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmAction from "../otherComponents/ConfirmAction";
import { useAppDispatch } from "../reduxToolKit/hooks";
import { scenarioLifecycle } from "../reduxToolKit/scenarioPlanningSlice";
import type { SavedScenario, ToastHandler } from "../types";
type Operation = "archive" | "restore" | "delete";
export default function ScenarioActions({
  record,
  busy,
  toast,
}: {
  record: SavedScenario;
  busy: boolean;
  toast: ToastHandler;
}) {
  const dispatch = useAppDispatch();
  const [operation, setOperation] = useState<Operation | null>(null);
  const archived = record.status === "ARCHIVED";
  return (
    <div className="scenario-record-actions">
      <span>{archived ? "Archived scenario" : "Saved in SQL Server"}</span>
      <div>
        {record.status === "SAVED" && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setOperation("archive")}
          >
            <Archive size={14} /> Archive scenario
          </button>
        )}
        {archived && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setOperation("restore")}
          >
            <RotateCcw size={14} /> Restore scenario
          </button>
        )}
        {(archived || record.status === "DRAFT") && (
          <button
            className="button secondary delete-icon"
            disabled={busy}
            onClick={() => setOperation("delete")}
          >
            <Trash2 size={14} /> Delete permanently
          </button>
        )}
      </div>
      {operation && (
        <ConfirmAction
          title={
            operation === "delete"
              ? "Delete scenario permanently?"
              : operation === "archive"
                ? "Archive scenario?"
                : "Restore scenario?"
          }
          label={
            operation === "delete"
              ? "Delete permanently"
              : operation === "archive"
                ? "Archive scenario"
                : "Restore scenario"
          }
          permanent={operation === "delete"}
          onClose={() => setOperation(null)}
          onConfirm={async () => {
            await dispatch(scenarioLifecycle({ record, operation })).unwrap();
            toast(
              operation === "delete"
                ? "Scenario permanently deleted. Employee profiles were preserved."
                : operation === "archive"
                  ? "Scenario archived. You can restore it from Archived."
                  : "Scenario restored to the active library.",
            );
          }}
        >
          <p>
            {operation === "delete"
              ? 'Permanently delete "' +
                record.projectTitle +
                '" and its requirements and team selections? This cannot be undone. Employees and skills will be kept.'
              : operation === "archive"
                ? 'Move "' +
                  record.projectTitle +
                  '" to Archived? Its team and saved scores are preserved.'
                : 'Restore "' +
                  record.projectTitle +
                  '" to the active scenario library with its saved team and scores?'}
          </p>
        </ConfirmAction>
      )}
    </div>
  );
}
