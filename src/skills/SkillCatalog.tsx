import {
  FolderOpen,
  FolderPlus,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/catalog-browse.scss";
import "../scss/catalog-sidebar.scss";
import "../scss/catalog.scss";
import Pagination, { usePagination } from "../otherComponents/Pagination";
import { useAppSelector } from "../reduxToolKit/hooks";
import type {
  CatalogDeleteState,
  CatalogEditorState,
  ToastHandler,
} from "../types";
import CatalogEditor from "./CatalogEditor";
import DeleteCatalogItem from "./DeleteCatalogItem";
import FolderSidebar from "./FolderSidebar";
import SkillList from "./SkillList";

export default function SkillCatalog({ toast }: { toast: ToastHandler }) {
  const { folders, skills, saving } = useAppSelector((s) => s.catalog);
  const employees = useAppSelector((s) => s.employees.items);
  const [selected, setSelected] = useState("frontend");
  const [skillSearch, setSkillSearch] = useState("");
  const [editor, setEditor] = useState<CatalogEditorState | null>(null);
  const [deleting, setDeleting] = useState<CatalogDeleteState | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeFolder = folders.find((f) => f.id === selected);
  const activeId = activeFolder?.id || "all";
  const filteredSkills = skills
    .filter(
      (skill) =>
        (!activeFolder || skill.folderId === activeFolder.id) &&
        skill.name
          .toLocaleLowerCase("en")
          .includes(skillSearch.trim().toLocaleLowerCase("en")),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const skillPage = usePagination(
    filteredSkills,
    JSON.stringify([activeId, skillSearch]),
  );
  const openFolder = (id: string) => {
    setSelected(id);
    setSkillSearch("");
    contentRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const displayedCount = skills.filter(
    (s) => !activeFolder || s.folderId === activeFolder.id,
  ).length;
  return (
    <section className="catalog" aria-label="Skill catalog">
      <div className="catalog-topline">
        <div>
          <h3>
            One place for every strength<span>{skills.length} skills</span>
          </h3>
          <p>
            Create skills, arrange folders, and keep your team’s expertise
            organized.
          </p>
        </div>
        <div className="catalog-toolbar-actions">
          <button
            className="button secondary"
            disabled={saving}
            onClick={() => setEditor({ mode: "folder" })}
          >
            <FolderPlus size={16} /> New folder
          </button>
          <button
            className="button primary"
            disabled={saving}
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
          folders={folders}
          skills={skills}
          activeFolder={activeFolder}
          activeId={activeId}
          onOpen={openFolder}
        />
        <div className="catalog-content" ref={contentRef}>
          <div className="catalog-folder-heading">
            <span
              className={`folder-heading-icon ${activeFolder?.color || "sage"}`}
            >
              {activeFolder ? <FolderOpen size={24} /> : <Layers3 size={24} />}
            </span>
            <div>
              <h3>
                {activeFolder?.name || "All skills"}
                <span>{displayedCount} skills</span>
              </h3>
              <p>
                {activeFolder
                  ? "A little structure for your team’s expertise."
                  : "Every strength in your workspace, one skill at a time."}
              </p>
            </div>
            {activeFolder && activeFolder.id !== "unsorted" && (
              <div className="folder-heading-actions">
                <button
                  className="icon-button"
                  disabled={saving}
                  aria-label={`Rename ${activeFolder.name} folder`}
                  onClick={() =>
                    setEditor({ mode: "folder", item: activeFolder })
                  }
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button delete-icon"
                  disabled={saving}
                  aria-label={`Delete ${activeFolder.name} folder`}
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
              aria-label="Search skill catalog"
              placeholder={`Search ${activeFolder ? activeFolder.name.toLowerCase() + " skills" : "all skills"}...`}
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
            />
            {skillSearch && (
              <button
                aria-label="Clear skill search"
                onClick={() => setSkillSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          {!skillPage.total ? (
            <div className="catalog-empty">
              <span>
                <FolderOpen size={30} />
              </span>
              <h3>
                {skillSearch
                  ? "No matching skills"
                  : "A fresh folder, full of possibilities."}
              </h3>
              <p>
                {skillSearch
                  ? "Try a different skill name or explore another folder."
                  : "Add your first skill or move an existing one into this folder."}
              </p>
              {skillSearch ? (
                <button
                  className="button secondary"
                  onClick={() => setSkillSearch("")}
                >
                  Clear search
                </button>
              ) : (
                <button
                  className="button secondary"
                  onClick={() =>
                    setEditor({ mode: "skill", folderId: activeFolder?.id })
                  }
                >
                  <Plus size={15} /> Add a skill
                </button>
              )}
            </div>
          ) : (
            <SkillList
              skills={skillPage.items}
              folders={folders}
              employees={employees}
              saving={saving}
              onEdit={(item) => setEditor({ mode: "skill", item })}
              onDelete={(item) => setDeleting({ mode: "skill", item })}
            />
          )}
          <Pagination
            pagination={skillPage}
            label="Skills"
            scrollTarget={contentRef}
          />
          <div className="catalog-safety-note">
            <ShieldCheck size={14} />
            <span>Assigned skills always show a warning before deletion.</span>
          </div>
        </div>
      </div>
      {editor && (
        <CatalogEditor
          {...editor}
          onClose={() => setEditor(null)}
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
