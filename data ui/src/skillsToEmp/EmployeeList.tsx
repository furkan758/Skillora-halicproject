import { Pencil } from "lucide-react";
import "../scss/employee-list.scss";
import Avatar from "../otherComponents/Avatar";
import { cx } from "../otherComponents/classNames";
import type { Employee } from "../types";
import SkillTag from "./SkillTag";

export default function EmployeeList({
  employees,
  onEdit,
}: {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
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
                  {Object.keys(e.skills)
                    .slice(0, 2)
                    .map((name) => (
                      <SkillTag key={name} name={name} />
                    ))}
                  {Object.keys(e.skills).length > 2 && (
                    <span
                      className="skill-tag more"
                      title={Object.keys(e.skills).slice(2).join(", ")}
                    >
                      +{Object.keys(e.skills).length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className={cx("availability", !e.available && "busy")}>
                  <i />
                  {e.available ? "Available" : "On a project"}
                </span>
              </td>
              <td className="employee-experience">
                {e.experience} {e.experience === 1 ? "year" : "years"}
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
