import { GitBranch, Layers3, Target, Users } from "lucide-react";
import "../scss/list-views.scss";
import Stat from "../otherComponents/Stat";
import { useAppSelector } from "../reduxToolKit/hooks";
export default function TeamStats() {
  const o = useAppSelector((s) => s.catalog.overview);
  return (
    <section className="stats-grid" aria-label="Team overview">
      <Stat
        icon={Users}
        label="Team members"
        value={o.employeeCount}
        detail="Talented people, one team"
        color="green"
      />
      <Stat
        icon={Layers3}
        label="Unique skills"
        value={o.skillCount}
        detail="Across your organization"
        color="purple"
      />
      <Stat
        icon={Target}
        label="Available for projects"
        value={o.availableCount}
        detail="Ready for the next challenge"
        color="orange"
      />
      <Stat
        icon={GitBranch}
        label="Departments"
        value={o.departmentCount}
        detail="Departments represented in your team"
        color="blue"
      />
    </section>
  );
}
