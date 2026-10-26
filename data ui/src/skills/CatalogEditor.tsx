import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import Dialog from "../otherComponents/Dialog";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { saveFolder, saveSkill } from "../reduxToolKit/store";
import type { CatalogEditorState, ToastHandler } from "../types";

export default function CatalogEditor({
  mode,
  item,
  folderId,
  onClose,
  onSaved,
}: CatalogEditorState & { onClose: () => void; onSaved: ToastHandler }) {
  const dispatch = useAppDispatch();
  const { folders, saving } = useAppSelector((s) => s.catalog);
  const [name, setName] = useState(item?.name || "");
  const [selectedFolder, setSelectedFolder] = useState(
    (item && "folderId" in item ? item.folderId : "") ||
      folderId ||
      folders[0]?.id ||
      "unsorted",
  );
  const [error, setError] = useState("");
  const isSkill = mode === "skill";
  const title = `${item ? "Edit" : "New"} ${isSkill ? "skill" : "folder"}`;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      if (isSkill)
        await dispatch(
          saveSkill({
            id: item?.id,
            name: name.trim(),
            folderId: selectedFolder,
          }),
        ).unwrap();
      else
        await dispatch(
          saveFolder({ id: item?.id, name: name.trim() }),
        ).unwrap();
      onSaved(
        `${isSkill ? "Skill" : "Folder"} ${item ? "updated" : "created"} successfully.`,
      );
      onClose();
    } catch (err) {
      setError(apiError(err).message);
    }
  };
  return (
    <Dialog
      title={title}
      subtitle={
        isSkill
          ? "Give your team’s expertise a place to belong."
          : "Organize your skills in a way that works for your team."
      }
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="catalog-editor" onSubmit={submit}>
        <label>
          {isSkill ? "Skill name" : "Folder name"}
          <input
            autoFocus
            required
            maxLength={60}
            placeholder={isSkill ? "e.g. JavaScript" : "e.g. Frontend"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </label>
        {isSkill && (
          <label>
            Folder
            <select
              aria-label="Skill folder"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              disabled={saving}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isSkill && item && (
          <div className="catalog-hint">
            <ShieldCheck size={16} />
            <p>
              Renaming or moving a skill keeps existing employee proficiency
              levels. Scenario criteria stay in sync.
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
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="button primary" disabled={saving || !name.trim()}>
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}{" "}
            {item ? "Save changes" : isSkill ? "Create skill" : "Create folder"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
