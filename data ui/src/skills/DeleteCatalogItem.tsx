import {
  AlertTriangle,
  FolderOpen,
  Layers3,
  LoaderCircle,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import Dialog from "../otherComponents/Dialog";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { deleteFolder, deleteSkill } from "../reduxToolKit/store";
import type {
  AffectedEmployee,
  CatalogDeleteState,
  ToastHandler,
} from "../types";

export default function DeleteCatalogItem({
  mode,
  item,
  onClose,
  onSaved,
}: CatalogDeleteState & { onClose: () => void; onSaved: ToastHandler }) {
  const dispatch = useAppDispatch();
  const employees = useAppSelector((s) => s.employees.items);
  const { skills, saving } = useAppSelector((s) => s.catalog);
  const criteria = useAppSelector((s) => s.planning.draft.requirements);
  const isSkill = mode === "skill";
  const [error, setError] = useState("");
  const [serverAffected, setServerAffected] = useState<
    AffectedEmployee[] | null
  >(null);
  const affected =
    serverAffected ||
    employees.filter((e) => Object.hasOwn(e.skills, item.name));
  const folderSkills = skills.filter((s) => s.folderId === item.id);
  const assigned = isSkill && affected.length > 0;
  const inScenario = isSkill && criteria.some((c) => c.skill === item.name);
  const submit = async () => {
    setError("");
    try {
      if (isSkill)
        await dispatch(
          deleteSkill({ id: item.id, confirmAssignedRemoval: assigned }),
        ).unwrap();
      else await dispatch(deleteFolder(item.id)).unwrap();
      onSaved(
        isSkill
          ? `“${item.name}” deleted from the skill catalog.`
          : `Folder deleted. ${folderSkills.length ? "Its skills were moved to Unsorted." : ""}`,
      );
      onClose();
    } catch (err) {
      const failure = apiError(err);
      if (failure.affectedEmployees)
        setServerAffected(failure.affectedEmployees);
      setError(failure.message);
    }
  };
  return (
    <Dialog
      title={`Delete ${isSkill ? "skill" : "folder"}?`}
      subtitle={`You’re about to delete “${item.name}”.`}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <div className="catalog-delete">
        {assigned ? (
          <>
            <div className="assignment-warning" role="alert">
              <AlertTriangle size={21} />
              <div>
                <h3>
                  This skill is assigned to {affected.length} team{" "}
                  {affected.length === 1 ? "member" : "members"}.
                </h3>
                <p>
                  Deleting it will also remove this skill and its proficiency
                  level from the following profiles.
                </p>
              </div>
            </div>
            <ul className="affected-members">
              {affected.map((e) => (
                <li key={e.id}>
                  <span>
                    {e.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <strong>{e.name}</strong>
                  <span className="member-level">
                    {e.skills?.[item.name]
                      ? `${e.skills[item.name]}/5 proficiency`
                      : "Skill assigned"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="delete-note">
              To keep these employee records, cancel and move the skill to
              another folder instead.
            </p>
          </>
        ) : isSkill ? (
          <div className="catalog-hint">
            <Users size={18} />
            <p>
              No team members currently have this skill. It will be removed from
              the catalog and from skill selectors.
            </p>
          </div>
        ) : (
          <div className="catalog-hint">
            <FolderOpen size={20} />
            <p>
              {folderSkills.length
                ? `${folderSkills.length} ${folderSkills.length === 1 ? "skill" : "skills"} in this folder will move to Unsorted. Employee skills and proficiency levels will be preserved.`
                : "This folder is empty. Deleting it will not affect employee profiles."}
            </p>
          </div>
        )}
        {inScenario && (
          <p className="scenario-delete-note">
            <Layers3 size={15} /> This skill will also be removed from the
            current scenario’s criteria.
          </p>
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
          <button className="button danger" disabled={saving} onClick={submit}>
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Trash2 size={15} />
            )}{" "}
            {assigned
              ? "Delete skill from everyone"
              : `Delete ${isSkill ? "skill" : "folder"}`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
