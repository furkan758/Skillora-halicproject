import { AlertTriangle, FolderOpen, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import Dialog from "../otherComponents/Dialog";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { deleteFolder, deleteSkill } from "../reduxToolKit/store";
import type { ApiError, CatalogDeleteState, ToastHandler } from "../types";

export default function DeleteCatalogItem({
  mode,
  item,
  onClose,
  onSaved,
}: CatalogDeleteState & { onClose: () => void; onSaved: ToastHandler }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.catalog.saving);
  const [error, setError] = useState("");
  const [affected, setAffected] = useState<ApiError["affectedEmployees"]>();
  const [confirmed, setConfirmed] = useState(false);
  const assignedCount = mode === "skill" ? item.teamMemberCount : 0;
  const submit = async () => {
    setError("");
    try {
      if (mode === "skill")
        await dispatch(
          deleteSkill({
            id: item.id,
            confirmAssignedRemoval: !!affected?.length && confirmed,
          }),
        ).unwrap();
      else await dispatch(deleteFolder(item.id)).unwrap();
      onSaved(
        mode === "skill"
          ? "Skill retired. Saved scenario history was preserved."
          : "Folder removed. Its skills were moved to Unsorted.",
      );
      onClose();
    } catch (error) {
      const failure = apiError(error);
      if (failure.affectedEmployees) {
        setAffected(failure.affectedEmployees);
        setConfirmed(false);
      }
      setError(failure.message);
    }
  };
  return (
    <Dialog
      title={"Delete " + mode + "?"}
      subtitle={'You are about to remove "' + item.name + '".'}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <div className="catalog-delete">
        {mode === "skill" ? (
          <>
            {(assignedCount > 0 || !!affected?.length) && (
              <div className="assignment-warning" role="alert">
                <AlertTriangle size={21} />
                <div>
                  <h3>
                    This skill is assigned to{" "}
                    {affected?.length ?? assignedCount} team members.
                  </h3>
                  <p>
                    Removing it retires their active skill assignments. Existing
                    scenario scores remain available.
                  </p>
                </div>
              </div>
            )}
            {affected ? (
              <>
                <ul className="affected-members">
                  {affected.map((e) => (
                    <li key={e.id}>
                      <strong>{e.name}</strong>
                      <span className="member-level">Skill assigned</span>
                    </li>
                  ))}
                </ul>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I reviewed these employees and want to remove this skill
                    from their profiles.
                  </span>
                </label>
              </>
            ) : (
              <p>
                {assignedCount > 0
                  ? "Review the current affected employees before confirming."
                  : "The server will check current assignments before removal."}
              </p>
            )}
          </>
        ) : (
          <div className="catalog-hint">
            <FolderOpen size={20} />
            <p>
              {item.skillCount} skills will move to Unsorted. Employee
              assignments and proficiency levels will be preserved.
            </p>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={saving || (!!affected?.length && !confirmed)}
            onClick={submit}
          >
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Trash2 size={15} />
            )}
            {mode === "skill" && !affected && assignedCount > 0
              ? "Review affected members"
              : affected?.length
                ? "Remove skill from these profiles"
                : "Delete " + mode}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
