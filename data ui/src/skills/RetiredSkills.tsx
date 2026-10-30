import { RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import Dialog from "../otherComponents/Dialog";
import RequestFeedback from "../otherComponents/RequestFeedback";
import Pagination from "../otherComponents/Pagination";
import { useApiPage } from "../otherComponents/useApiPage";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { restoreSkill } from "../reduxToolKit/store";
import type { Skill, ToastHandler } from "../types";
export default function RetiredSkills({
  onClose,
  toast,
}: {
  onClose: () => void;
  toast: ToastHandler;
}) {
  const dispatch = useAppDispatch();
  const { revision, saving } = useAppSelector((s) => s.catalog);
  const [query, setQuery] = useState(""),
    [error, setError] = useState("");
  const page = useApiPage<Skill>("/retired-skills", { q: query }, revision);
  return (
    <Dialog
      title="Deleted skills"
      subtitle="Restore the original skill. Former employee assignments stay removed."
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <div className="catalog-editor">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search deleted skills"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={200}
          />
        </label>
        <RequestFeedback
          status={page.status}
          error={page.error}
          onRetry={page.retry}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {page.status === "succeeded" && (
          <>
            <ul className="restore-list">
              {page.items.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.folderName}</small>
                  </div>
                  <button
                    className="button secondary"
                    disabled={saving}
                    onClick={async () => {
                      setError("");
                      try {
                        await dispatch(restoreSkill(s.id)).unwrap();
                        toast(
                          s.name +
                            " restored. Reassign it to employees when needed.",
                        );
                      } catch (error) {
                        setError(apiError(error).message);
                      }
                    }}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                </li>
              ))}
            </ul>
            {!page.total && <p>No deleted skills found.</p>}
            <Pagination pagination={page} label="Deleted skills" />
          </>
        )}
      </div>
    </Dialog>
  );
}
