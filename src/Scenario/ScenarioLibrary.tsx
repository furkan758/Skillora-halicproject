import {
  ClipboardList,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/scenario-wizard.scss";
import Pagination, { usePagination } from "../otherComponents/Pagination";
import { useAppDispatch } from "../reduxToolKit/hooks";
import { fetchSavedScenarios } from "../reduxToolKit/scenarioPlanningSlice";
import type { PlanningState } from "../types";

export default function ScenarioLibrary({
  planning,
  selectedId,
  busy,
  onNew,
  onSelect,
}: {
  planning: Pick<PlanningState, "saved" | "savedStatus" | "libraryError">;
  selectedId?: string;
  busy: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
}) {
  const dispatch = useAppDispatch();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const libraryRef = useRef<HTMLElement>(null);
  const libraryPage = usePagination(
    planning.saved.filter((s) =>
      `${s.title} ${s.client}`
        .toLowerCase()
        .includes(libraryQuery.toLowerCase()),
    ),
    libraryQuery,
  );
  return (
    <aside
      className={`scenario-library${libraryOpen ? " expanded" : ""}`}
      ref={libraryRef}
      aria-label="Saved scenario library"
    >
      <button
        className="library-mobile-toggle"
        aria-expanded={libraryOpen}
        onClick={() => setLibraryOpen((open) => !open)}
      >
        <FolderOpen size={17} /> My scenarios{" "}
        <span>{planning.saved.length}</span>
      </button>
      <div className="scenario-library-body">
        <div className="library-heading">
          <span>MY SCENARIOS</span>
          <span>{planning.saved.length}</span>
        </div>
        <button
          className="button primary library-new"
          disabled={busy}
          onClick={() => onNew()}
        >
          <Plus size={15} /> New scenario
        </button>
        <label className="library-search">
          <Search size={14} />
          <input
            aria-label="Search saved scenarios"
            placeholder="Search projects..."
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
          />
        </label>
        {planning.savedStatus === "loading" && (
          <div className="library-loading">
            <LoaderCircle className="spin" size={17} /> Loading scenarios...
          </div>
        )}
        {planning.libraryError && (
          <div className="library-error">
            <p role="alert">{planning.libraryError}</p>
            <button onClick={() => dispatch(fetchSavedScenarios())}>
              Try again
            </button>
          </div>
        )}
        <nav className="saved-scenario-list" aria-label="Saved scenarios">
          {libraryPage.items.map((record) => (
            <button
              disabled={busy}
              key={record.id}
              className={record.id === selectedId ? "active" : ""}
              aria-current={record.id === selectedId ? "page" : undefined}
              onClick={() => {
                onSelect(record.id);
                setLibraryOpen(false);
              }}
            >
              <span className="saved-scenario-icon">
                <ClipboardList size={16} />
              </span>
              <span>
                <strong>{record.title}</strong>
                <small>
                  {record.client} · {record.headcount} people
                </small>
              </span>
              <b>{record.summary.averageScore}%</b>
            </button>
          ))}
        </nav>
        {!planning.saved.length && planning.savedStatus === "succeeded" && (
          <div className="library-empty">
            <FolderOpen size={27} />
            <h3>A home for your scenarios.</h3>
            <p>Saved teams appear here under their project titles.</p>
          </div>
        )}
        {planning.saved.length > 0 && !libraryPage.total && (
          <p className="library-no-results">No matching projects.</p>
        )}
        {planning.saved.length > 0 && (
          <Pagination
            pagination={libraryPage}
            label="Saved scenarios"
            scrollTarget={libraryRef}
          />
        )}
        <div className="library-footnote">
          <ShieldCheck size={14} />
          <span>Your scenarios, saved in this browser.</span>
        </div>
      </div>
    </aside>
  );
}
