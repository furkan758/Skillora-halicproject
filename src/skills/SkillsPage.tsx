import { Plus } from "lucide-react";
import { useAppSelector } from "../reduxToolKit/hooks";
import TalentDirectory from "../skillsToEmp/TalentDirectory";
import type { Employee, ToastHandler } from "../types";
import SkillsHero from "./SkillsHero";
import TeamStats from "./TeamStats";

export default function SkillsPage({
  onEdit,
  onScenario,
  toast,
}: {
  onEdit: (employee: Employee | "new") => void;
  onScenario: () => void;
  toast: ToastHandler;
}) {
  const items = useAppSelector((s) => s.employees.items);
  const catalogSkills = useAppSelector((s) => s.catalog.skills);
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">YOUR PEOPLE. THEIR POTENTIAL.</div>
          <h1>
            A world of talent, in your team<span>.</span>
          </h1>
          <p>
            Discover strengths, nurture expertise, and make great things happen.
          </p>
        </div>
        <button className="button primary" onClick={() => onEdit("new")}>
          <Plus size={18} /> Add team member
        </button>
      </section>
      <SkillsHero onScenario={onScenario} />
      <TeamStats items={items} catalogSkills={catalogSkills} />
      <TalentDirectory onEdit={onEdit} toast={toast} />
    </>
  );
}
