import {
  ChevronDown,
  Folder as FolderIcon,
  Layers3,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/catalog-browse.scss";
import "../scss/catalog-sidebar.scss";
import "../scss/catalog.scss";
import Pagination, { usePagination } from "../otherComponents/Pagination";
import type { Folder, Skill } from "../types";

export default function FolderSidebar({
  folders,
  skills,
  activeFolder,
  activeId,
  onOpen,
}: {
  folders: Folder[];
  skills: Skill[];
  activeFolder?: Folder;
  activeId: string;
  onOpen: (id: string) => void;
}) {
  const [folderSearch, setFolderSearch] = useState("");
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const folderRef = useRef<HTMLElement>(null);
  const filteredFolders = folders.filter((folder) =>
    folder.name
      .toLocaleLowerCase("en")
      .includes(folderSearch.trim().toLocaleLowerCase("en")),
  );
  const folderPage = usePagination(filteredFolders, folderSearch);
  const openFolder = (id: string) => {
    onOpen(id);
    setFolderBrowserOpen(false);
  };
  return (
    <aside
      className={`catalog-folder-browser${folderBrowserOpen ? " expanded" : ""}`}
      aria-label="Skill folders"
      ref={folderRef}
    >
      <button
        className="folder-browser-toggle"
        aria-expanded={folderBrowserOpen}
        aria-controls="folder-browser-content"
        onClick={() => setFolderBrowserOpen((open) => !open)}
      >
        <FolderIcon size={17} />
        <span>
          Folders <small>{folders.length}</small>
        </span>
        <strong>{activeFolder?.name || "All skills"}</strong>
        <ChevronDown size={15} />
      </button>
      <div className="folder-browser-body" id="folder-browser-content">
        <div className="catalog-folder-label">
          YOUR FOLDERS <span>{folders.length}</span>
        </div>
        <button
          className={`catalog-folder-button all-skills-link ${activeId === "all" ? "active" : ""}`}
          aria-label="Show all skills"
          aria-pressed={activeId === "all"}
          onClick={() => openFolder("all")}
        >
          <Layers3 size={17} />
          <span>All skills</span>
          <b>{skills.length}</b>
        </button>
        <div className="catalog-folder-divider" />
        <label className="folder-browser-search">
          <Search size={13} />
          <input
            aria-label="Search folders"
            placeholder="Find a folder..."
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
          />
          {folderSearch && (
            <button
              aria-label="Clear folder search"
              onClick={() => setFolderSearch("")}
            >
              <X size={12} />
            </button>
          )}
        </label>
        <nav
          className="catalog-folder-items"
          aria-label="Choose a skill folder"
        >
          {folderPage.items.map((folder) => (
            <button
              key={folder.id}
              className={`catalog-folder-button ${activeId === folder.id ? "active" : ""}`}
              aria-label={`Select ${folder.name} folder`}
              aria-pressed={activeId === folder.id}
              onClick={() => openFolder(folder.id)}
            >
              <FolderIcon size={16} />
              <span>{folder.name}</span>
              <b>{skills.filter((s) => s.folderId === folder.id).length}</b>
            </button>
          ))}
        </nav>
        {!folderPage.total && (
          <div className="folder-browser-empty">
            <p>No folders found.</p>
            <button onClick={() => setFolderSearch("")}>Clear search</button>
          </div>
        )}
        <Pagination
          pagination={folderPage}
          label="Folders"
          scrollTarget={folderRef}
        />
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
