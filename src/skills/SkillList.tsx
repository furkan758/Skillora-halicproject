import { Code2, Folder as FolderIcon, Pencil, Trash2 } from "lucide-react";
import { progressPercentage } from "../otherComponents/progress";
import "../scss/progress.scss";
import type { Catalog, Employee, Skill } from "../types";

export default function SkillList({
  skills,
  folders,
  employees,
  saving,
  onEdit,
  onDelete,
}: Catalog & {
  employees: Employee[];
  saving: boolean;
  onEdit: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
}) {
  return (
    <div className="data-list-scroll">
      <table className="data-list skill-list" aria-label="Skill list">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Folder</th>
            <th scope="col">Team members</th>
            <th scope="col">Avg. proficiency</th>
            <th scope="col" className="list-actions-heading">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => {
            const folder = folders.find((f) => f.id === skill.folderId) || {
              name: "Unsorted",
              color: "sage",
            };
            const assigned = employees.filter((e) =>
              Object.hasOwn(e.skills, skill.name),
            );
            const average = assigned.length
              ? assigned.reduce((sum, e) => sum + e.skills[skill.name], 0) /
                assigned.length
              : 0;
            return (
              <tr key={skill.id}>
                <td>
                  <button
                    className="list-skill-name"
                    aria-label={`Edit ${skill.name} skill`}
                    disabled={saving}
                    onClick={() => onEdit(skill)}
                  >
                    <span className={`catalog-code-icon ${folder.color}`}>
                      <Code2 size={17} />
                    </span>
                    <strong>{skill.name}</strong>
                  </button>
                </td>
                <td>
                  <button
                    className="list-folder-tag"
                    aria-label={`Move ${skill.name} to another folder`}
                    disabled={saving}
                    onClick={() => onEdit(skill)}
                  >
                    <FolderIcon size={12} />
                    {folder.name}
                  </button>
                </td>
                <td>
                  {assigned.length ? (
                    `${assigned.length} ${assigned.length === 1 ? "member" : "members"}`
                  ) : (
                    <span className="list-muted">Not assigned</span>
                  )}
                </td>
                <td>
                  <div className="list-proficiency">
                    <strong>
                      {assigned.length ? `${average.toFixed(1)} / 5` : "—"}
                    </strong>
                    <div
                      className="proficiency-track"
                      role="meter"
                      aria-label={`${skill.name} average proficiency`}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={average}
                      data-progress={progressPercentage(average, 5)}
                    >
                      <span />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="list-row-actions">
                    <button
                      className="icon-button"
                      disabled={saving}
                      aria-label={`Edit ${skill.name} details`}
                      onClick={() => onEdit(skill)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete-icon"
                      disabled={saving}
                      aria-label={`Delete ${skill.name} skill`}
                      onClick={() => onDelete(skill)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
