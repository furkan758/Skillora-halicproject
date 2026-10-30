import { Pencil, Trash2 } from "lucide-react";
import "../scss/employee-list.scss";
import Avatar from "../otherComponents/Avatar";
import { cx } from "../otherComponents/classNames";
import type { Employee } from "../types";
import SkillTag from "./SkillTag";

export default function EmployeeList({
  employees,
  onEdit,
  onDelete,
}: {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}) {
  return (
    <div className="data-list-scroll">
      <table className="data-list employee-list" aria-label="Team member list">
        <thead>
          <tr>
            <th scope="col" className="employee-id-heading">
              ID
            </th>
            <th scope="col">First name</th>
            <th scope="col">Last name</th>
            <th scope="col">Department</th>
            <th scope="col">Skills</th>
            <th scope="col">Availability</th>
            <th scope="col">Experience</th>
            <th scope="col">Gender</th>
            <th scope="col" className="list-actions-heading">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td className="employee-id">{e.id}</td>
              <td>
                <button
                  className="list-person-name"
                  aria-label={`View ${e.name}'s profile`}
                  onClick={() => onEdit(e)}
                >
                  <Avatar employee={e} size="tiny" />
                  <span>
                    <strong>{e.firstName}</strong>
                  </span>
                </button>
              </td>
              <td className="employee-last-name">{e.lastName || "—"}</td>
              <td>{e.department}</td>
              <td>
                <div className="list-skill-tags">
                  {e.skills.slice(0, 2).map((skill) => (
                    <SkillTag key={skill.skillId} name={skill.skillName} />
                  ))}
                  {e.skills.length > 2 && (
                    <span
                      className="skill-tag more"
                      title={e.skills
                        .slice(2)
                        .map((s) => s.skillName)
                        .join(", ")}
                    >
                      +{e.skills.length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className={cx("availability", !e.isAvailable && "busy")}>
                  <i />
                  {e.isAvailable ? "Available" : "On a project"}
                </span>
              </td>
              <td className="employee-experience">
                <span
                  title={e.skills
                    .map(
                      (s) =>
                        `${s.skillName}: ${s.experienceYears ?? "Unknown"} years`,
                    )
                    .join(" · ")}
                >
                  {e.skills
                    .filter((s) => s.experienceYears !== null)
                    .slice(0, 2)
                    .map((s) => `${s.skillName}: ${s.experienceYears}y`)
                    .join(" · ") || "Not recorded"}
                </span>
              </td>
              <td className="employee-gender">
                <span className="gender-badge" data-gender={e.gender}>
                  {e.gender}
                </span>
              </td>
              <td>
                <div className="list-row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${e.name}`}
                    onClick={() => onEdit(e)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button delete-icon"
                    aria-label={`Remove ${e.name}`}
                    onClick={() => onDelete(e)}
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
