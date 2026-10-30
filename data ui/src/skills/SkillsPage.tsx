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
      </section>
      <SkillsHero onScenario={onScenario} />
      <TeamStats />
      <TalentDirectory onEdit={onEdit} toast={toast} />
    </>
  );
}
