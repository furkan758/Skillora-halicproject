import { GitBranch, Layers3, Target, Users } from "lucide-react";
import "../scss/list-views.scss";
import Stat from "../otherComponents/Stat";
import type { Employee, Skill } from "../types";

export default function TeamStats({
  items,
  catalogSkills,
}: {
  items: Employee[];
  catalogSkills: Skill[];
}) {
  return (
    <section className="stats-grid" aria-label="Team overview">
      <Stat
        icon={Users}
        label="Team members"
        value={String(items.length).padStart(2, "0")}
        detail="Talented people, one team"
        color="green"
      />
      <Stat
        icon={Layers3}
        label="Unique skills"
        value={catalogSkills.length}
        detail="Across your organization"
        color="purple"
      />
      <Stat
        icon={Target}
        label="Available for projects"
        value={String(items.filter((e) => e.available).length).padStart(2, "0")}
        detail="Ready for the next challenge"
        color="orange"
      />
      <Stat
        icon={GitBranch}
        label="Departments"
        value={String(new Set(items.map((e) => e.department)).size).padStart(
          2,
          "0",
        )}
        detail="Different strengths, shared goals"
        color="blue"
      />
    </section>
  );
}
