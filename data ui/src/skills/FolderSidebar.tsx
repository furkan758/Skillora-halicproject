import {
  ChevronDown,
  Folder as FolderIcon,
  Layers3,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/catalog-sidebar.scss";
import Pagination from "../otherComponents/Pagination";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { useApiPage } from "../otherComponents/useApiPage";
import type { Folder } from "../types";
export default function FolderSidebar({
  folderCount,
  skillCount,
  activeFolder,
  activeId,
  onOpen,
  revision,
}: {
  folderCount: number;
  skillCount: number;
  activeFolder?: Folder;
  activeId: number | "all";
  onOpen: (id: number | "all") => void;
  revision: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const page = useApiPage<Folder>("/folders", { q: query }, revision);
  const choose = (id: number | "all") => {
    onOpen(id);
    setOpen(false);
  };
  return (
    <aside
      className={"catalog-folder-browser" + (open ? " expanded" : "")}
      aria-label="Skill folders"
      ref={ref}
    >
      <button
        className="folder-browser-toggle"
        aria-expanded={open}
        aria-controls="folder-browser-content"
        onClick={() => setOpen(!open)}
      >
        <FolderIcon size={17} />
        <span>
          Folders <small>{folderCount}</small>
        </span>
        <strong>{activeFolder?.name || "All skills"}</strong>
        <ChevronDown size={15} />
      </button>
      <div className="folder-browser-body" id="folder-browser-content">
        <div className="catalog-folder-label">
          YOUR FOLDERS <span>{folderCount}</span>
        </div>
        <button
          className={
            "catalog-folder-button all-skills-link " +
            (activeId === "all" ? "active" : "")
          }
          aria-label="Show all skills"
          aria-pressed={activeId === "all"}
          onClick={() => choose("all")}
        >
          <Layers3 size={17} />
          <span>All skills</span>
          <b>{skillCount}</b>
        </button>
        <div className="catalog-folder-divider" />
        <label className="folder-browser-search">
          <Search size={13} />
          <input
            aria-label="Search folders"
            maxLength={200}
            placeholder="Find a folder..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <RequestFeedback
          status={page.status}
          error={page.error}
          onRetry={page.retry}
        />
        {page.status === "succeeded" && (
          <>
            <nav
              className="catalog-folder-items"
              aria-label="Choose a skill folder"
            >
              {page.items.map((folder) => (
                <button
                  key={folder.id}
                  className={
                    "catalog-folder-button " +
                    (activeId === folder.id ? "active" : "")
                  }
                  aria-label={"Select " + folder.name + " folder"}
                  aria-pressed={activeId === folder.id}
                  onClick={() => choose(folder.id)}
                >
                  <FolderIcon size={16} />
                  <span>{folder.name}</span>
                  <b>{folder.skillCount}</b>
                </button>
              ))}
            </nav>
            {!page.total && (
              <p className="folder-browser-empty">No folders found.</p>
            )}
            <Pagination pagination={page} label="Folders" scrollTarget={ref} />
          </>
        )}
        <div className="catalog-folder-tip">
          <ShieldCheck size={15} />
          <p>
            Your structure. Your rules.
            <br />
            Select a folder to manage its skills.
          </p>
        </div>
      </div>
    </aside>
  );
}
