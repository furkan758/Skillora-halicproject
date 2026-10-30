import { Code2, Folder, Pencil, Trash2 } from "lucide-react";
import { progressPercentage } from "../otherComponents/progress";
import "../scss/progress.scss";
import type { Skill } from "../types";
export default function SkillList({
  skills,
  saving,
  onEdit,
  onDelete,
}: {
  skills: Skill[];
  saving: boolean;
  onEdit: (s: Skill) => void;
  onDelete: (s: Skill) => void;
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
          {skills.map((skill) => (
            <tr key={skill.id}>
              <td>
                <button
                  className="list-skill-name"
                  disabled={saving}
                  aria-label={"Edit " + skill.name + " skill"}
                  onClick={() => onEdit(skill)}
                >
                  <span className="catalog-code-icon sage">
                    <Code2 size={17} />
                  </span>
                  <strong>{skill.name}</strong>
                </button>
              </td>
              <td>
                <button
                  className="list-folder-tag"
                  disabled={saving}
                  aria-label={"Move " + skill.name + " to another folder"}
                  onClick={() => onEdit(skill)}
                >
                  <Folder size={12} />
                  {skill.folderName}
                </button>
              </td>
              <td>
                {skill.teamMemberCount ? (
                  skill.teamMemberCount +
                  (skill.teamMemberCount === 1 ? " member" : " members")
                ) : (
                  <span className="list-muted">Not assigned</span>
                )}
              </td>
              <td>
                <div className="list-proficiency">
                  <strong>
                    {skill.averageProficiency === null
                      ? "Not assessed"
                      : skill.averageProficiency.toFixed(1) + " / 5"}
                  </strong>
                  <div
                    className="proficiency-track"
                    role="meter"
                    aria-label={skill.name + " average proficiency"}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    aria-valuenow={skill.averageProficiency ?? 0}
                    data-progress={progressPercentage(
                      skill.averageProficiency ?? 0,
                      5,
                    )}
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
                    aria-label={"Edit " + skill.name + " details"}
                    onClick={() => onEdit(skill)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button delete-icon"
                    disabled={saving}
                    aria-label={"Delete " + skill.name + " skill"}
                    onClick={() => onDelete(skill)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
