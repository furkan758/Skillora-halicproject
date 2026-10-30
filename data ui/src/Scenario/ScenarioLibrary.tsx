import {
  ClipboardList,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/scenario-wizard.scss";
import Pagination from "../otherComponents/Pagination";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { pageControls } from "../otherComponents/serverPage";
import { useAppDispatch } from "../reduxToolKit/hooks";
import {
  fetchSavedScenarios,
  setLibraryPage,
  setLibraryStatus,
  setLibraryQuery,
} from "../reduxToolKit/scenarioPlanningSlice";
import type { PlanningState } from "../types";
export default function ScenarioLibrary({
  planning,
  selectedId,
  busy,
  onNew,
  onSelect,
}: {
  planning: PlanningState;
  selectedId?: number;
  busy: boolean;
  onNew: () => void;
  onSelect: (id: number) => void;
}) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  return (
    <aside
      className={"scenario-library" + (open ? " expanded" : "")}
      ref={ref}
      aria-label="Saved scenario library"
    >
      <button
        className="library-mobile-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <FolderOpen size={17} /> My scenarios{" "}
        <span>{planning.saved.total}</span>
      </button>
      <div className="scenario-library-body">
        <div className="library-heading">
          <span>MY SCENARIOS</span>
          <span>{planning.saved.total}</span>
        </div>
        <button
          className="button primary library-new"
          disabled={busy}
          onClick={onNew}
        >
          <Plus size={15} /> New scenario
        </button>
        <div
          className="library-status-tabs"
          aria-label="Scenario library status"
        >
          <button
            aria-pressed={planning.libraryStatus === "active"}
            onClick={() => dispatch(setLibraryStatus("active"))}
          >
            Active
          </button>
          <button
            aria-pressed={planning.libraryStatus === "ARCHIVED"}
            onClick={() => dispatch(setLibraryStatus("ARCHIVED"))}
          >
            Archived
          </button>
        </div>
        <label className="library-search">
          <Search size={14} />
          <input
            maxLength={200}
            aria-label="Search saved scenarios"
            placeholder="Search projects..."
            value={planning.libraryQuery}
            onChange={(e) => dispatch(setLibraryQuery(e.target.value))}
          />
        </label>
        <RequestFeedback
          status={planning.savedStatus}
          error={planning.libraryError}
          onRetry={() => dispatch(fetchSavedScenarios())}
        />
        {planning.savedStatus === "succeeded" && (
          <>
            <nav className="saved-scenario-list" aria-label="Saved scenarios">
              {planning.saved.items.map((record) => (
                <button
                  disabled={busy}
                  key={record.id}
                  className={record.id === selectedId ? "active" : ""}
                  aria-current={record.id === selectedId ? "page" : undefined}
                  onClick={() => {
                    onSelect(record.id);
                    setOpen(false);
                  }}
                >
                  <span className="saved-scenario-icon">
                    <ClipboardList size={16} />
                  </span>
                  <span>
                    <strong>{record.projectTitle}</strong>
                    <small>
                      {record.clientName} · {record.requiredPeople} people
                    </small>
                  </span>
                  <b>
                    {record.averageCompatibility === null
                      ? "Draft"
                      : record.averageCompatibility + "%"}
                  </b>
                </button>
              ))}
            </nav>
            {!planning.saved.total && (
              <div className="library-empty">
                <FolderOpen size={27} />
                <h3>No saved scenarios.</h3>
                <p>Saved teams appear here under their project titles.</p>
              </div>
            )}
            <Pagination
              pagination={pageControls(planning.saved, (page) =>
                dispatch(setLibraryPage(page)),
              )}
              label="Saved scenarios"
              scrollTarget={ref}
            />
          </>
        )}
        <div className="library-footnote">
          <ShieldCheck size={14} />
          <span>Your scenarios, saved in SQL Server.</span>
        </div>
      </div>
    </aside>
  );
}
