import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useFormDraft } from "../otherComponents/useFormDraft";
import {
  formDraftKey,
  setActiveForm,
  validCatalogDraft,
} from "../otherComponents/draftStorage";
import Dialog from "../otherComponents/Dialog";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { restoreSkill, saveFolder, saveSkill } from "../reduxToolKit/store";
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
  const draft = useFormDraft(
    formDraftKey(mode, item?.id),
    {
      name: item?.name || "",
      description: item?.description || "",
      folderId:
        (item && "folderId" in item ? item.folderId : 0) ||
        folderId ||
        folders[0]?.id ||
        0,
    },
    validCatalogDraft,
  );
  const { name, description, folderId: selectedFolder } = draft.form;
  const setName = (name: string) => {
    draft.setForm((s) => ({ ...s, name }));
    setRetiredId(null);
    setError("");
  };
  const setDescription = (description: string) =>
    draft.setForm((s) => ({ ...s, description }));
  const setSelectedFolder = (folderId: number) =>
    draft.setForm((s) => ({ ...s, folderId }));
  const [retiredId, setRetiredId] = useState<number | null>(null);
  useEffect(() => {
    setActiveForm("catalog", { kind: mode, id: item?.id ?? null, folderId });
  }, [mode, item?.id, folderId]);
  const [error, setError] = useState("");
  const isSkill = mode === "skill";
  const title = `${item ? "Edit" : "New"} ${isSkill ? "skill" : "folder"}`;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setRetiredId(null);
    try {
      if (isSkill)
        await dispatch(
          saveSkill({
            id: item?.id,
            name: name.trim(),
            folderId: selectedFolder,
            description: description.trim() || null,
          }),
        ).unwrap();
      else
        await dispatch(
          saveFolder({
            id: item?.id,
            name: name.trim(),
            description: description.trim() || null,
          }),
        ).unwrap();
      onSaved(
        `${isSkill ? "Skill" : "Folder"} ${item ? "updated" : "created"} successfully.`,
      );
      draft.clear();
      onClose();
    } catch (err) {
      const failure = apiError(err);
      setError(failure.message);
      setRetiredId(failure.retiredSkillId ?? null);
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
        <p className="draft-note" role="status">
          {draft.restored ? "Unsaved draft restored. " : ""}Changes are kept in
          this tab until you save or discard them.
        </p>
        {draft.storageError && (
          <p className="error" role="alert">
            {draft.storageError}
          </p>
        )}
        <label>
          {isSkill ? "Skill name" : "Folder name"}
          <input
            autoFocus
            required
            maxLength={100}
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
              onChange={(e) => setSelectedFolder(Number(e.target.value))}
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
        <label>
          Description (optional)
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {retiredId && (
          <button
            type="button"
            className="button secondary"
            disabled={saving}
            onClick={async () => {
              try {
                await dispatch(restoreSkill(retiredId)).unwrap();
                draft.clear();
                onSaved(
                  "Original skill restored. Former employee assignments remain removed.",
                );
                onClose();
              } catch (err) {
                setError(apiError(err).message);
              }
            }}
          >
            Restore original skill
          </button>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              draft.clear();
              onClose();
            }}
            disabled={saving}
          >
            Discard draft
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
