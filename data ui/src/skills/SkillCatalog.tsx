import {
  FolderOpen,
  FolderPlus,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "../scss/catalog-browse.scss";
import "../scss/catalog-sidebar.scss";
import "../scss/catalog.scss";
import Pagination from "../otherComponents/Pagination";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { useApiPage } from "../otherComponents/useApiPage";
import { useAppSelector } from "../reduxToolKit/hooks";
import type {
  CatalogDeleteState,
  CatalogEditorState,
  Skill,
  ToastHandler,
} from "../types";
import RetiredSkills from "./RetiredSkills";
import {
  getActiveForm,
  closeActiveForm,
} from "../otherComponents/draftStorage";
import CatalogEditor from "./CatalogEditor";
import DeleteCatalogItem from "./DeleteCatalogItem";
import FolderSidebar from "./FolderSidebar";
import SkillList from "./SkillList";

export default function SkillCatalog({ toast }: { toast: ToastHandler }) {
  const { folders, skills, saving, revision, status } = useAppSelector(
    (s) => s.catalog,
  );
  const [retiredOpen, setRetiredOpen] = useState(false);
  const resumed = useRef(false);
  useEffect(() => {
    if (status !== "succeeded" || resumed.current) return;
    resumed.current = true;
    const active = getActiveForm("catalog");
    if (active?.kind === "skill") {
      const item = skills.find((s) => s.id === active.id);
      if (active.id === null || item)
        setEditor({ mode: "skill", item, folderId: active.folderId });
    } else if (active?.kind === "folder") {
      const item = folders.find((f) => f.id === active.id);
      if (active.id === null || item) setEditor({ mode: "folder", item });
    }
  }, [status, folders, skills]);
  const [selected, setSelected] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<CatalogEditorState | null>(null);
  const [deleting, setDeleting] = useState<CatalogDeleteState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const activeFolder = folders.find((f) => f.id === selected);
  const activeId = activeFolder?.id || "all";
  const page = useApiPage<Skill>(
    "/skills",
    { q: query, folderId: activeFolder?.id },
    revision,
  );
  return (
    <section className="catalog" aria-label="Skill catalog">
      <div className="catalog-topline">
        <div>
          <h3>
            One place for every strength<span>{skills.length} skills</span>
          </h3>
          <p>
            Create skills, arrange folders, and keep your team's expertise
            organized.
          </p>
        </div>
        <div className="catalog-toolbar-actions">
          <button
            className="button secondary"
            onClick={() => setRetiredOpen(true)}
          >
            Deleted skills
          </button>
          <button
            className="button secondary"
            disabled={saving}
            onClick={() => setEditor({ mode: "folder" })}
          >
            <FolderPlus size={16} /> New folder
          </button>
          <button
            className="button primary"
            disabled={saving || !folders.length}
            onClick={() =>
              setEditor({ mode: "skill", folderId: activeFolder?.id })
            }
          >
            <Plus size={16} /> New skill
          </button>
        </div>
      </div>
      <div className="catalog-layout catalog-list-layout catalog-with-sidebar">
        <FolderSidebar
          folderCount={folders.length}
          skillCount={skills.length}
          activeFolder={activeFolder}
          activeId={activeId}
          onOpen={(id) => {
            setSelected(id);
            setQuery("");
          }}
          revision={revision}
        />
        <div className="catalog-content" ref={ref}>
          <div className="catalog-folder-heading">
            <span className="folder-heading-icon sage">
              {activeFolder ? <FolderOpen size={24} /> : <Layers3 size={24} />}
            </span>
            <div>
              <h3>
                {activeFolder?.name || "All skills"}
                <span>{activeFolder?.skillCount ?? skills.length} skills</span>
              </h3>
              <p>A little structure for your team's expertise.</p>
            </div>
            {activeFolder && !activeFolder.isDefault && (
              <div className="folder-heading-actions">
                <button
                  className="icon-button"
                  disabled={saving}
                  aria-label={"Rename " + activeFolder.name + " folder"}
                  onClick={() =>
                    setEditor({ mode: "folder", item: activeFolder })
                  }
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button delete-icon"
                  disabled={saving}
                  aria-label={"Delete " + activeFolder.name + " folder"}
                  onClick={() =>
                    setDeleting({ mode: "folder", item: activeFolder })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
          <label className="search-field catalog-search">
            <Search size={17} />
            <input
              maxLength={200}
              aria-label="Search skill catalog"
              placeholder={
                "Search " + (activeFolder?.name || "all skills") + "..."
              }
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
              {page.items.length ? (
                <SkillList
                  skills={page.items}
                  saving={saving}
                  onEdit={(item) => setEditor({ mode: "skill", item })}
                  onDelete={(item) => setDeleting({ mode: "skill", item })}
                />
              ) : (
                <div className="catalog-empty">
                  <FolderOpen size={30} />
                  <h3>No skills found</h3>
                  <p>Try another name or add a skill to this folder.</p>
                </div>
              )}
              <Pagination pagination={page} label="Skills" scrollTarget={ref} />
            </>
          )}
          <div className="catalog-safety-note">
            <ShieldCheck size={14} />
            <span>
              Assigned skills require a warning and explicit confirmation before
              removal.
            </span>
          </div>
        </div>
      </div>
      {retiredOpen && (
        <RetiredSkills onClose={() => setRetiredOpen(false)} toast={toast} />
      )}
      {editor && (
        <CatalogEditor
          {...editor}
          onClose={() => {
            closeActiveForm("catalog");
            setEditor(null);
          }}
          onSaved={toast}
        />
      )}
      {deleting && (
        <DeleteCatalogItem
          {...deleting}
          onClose={() => setDeleting(null)}
          onSaved={toast}
        />
      )}
    </section>
  );
}
