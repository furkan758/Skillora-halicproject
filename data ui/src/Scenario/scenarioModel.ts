import type {
  CandidateGroup,
  Employee,
  SavedScenario,
  ScenarioDraft,
  Selections,
  Skill,
  SkillRequirement,
  TeamSummary,
} from "../types";
import { rankMatches } from "./matchRanking";

export function allocationError(draft: ScenarioDraft, catalogSkills: Skill[]) {
  if (!draft.title?.trim()) return "Enter a project title.";
  if (!draft.client?.trim()) return "Enter a client name.";
  if (
    !Number.isInteger(draft.headcount) ||
    draft.headcount < 1 ||
    draft.headcount > 100
  )
    return "Choose a team size between 1 and 100.";
  if (!Array.isArray(draft.requirements) || !draft.requirements.length)
    return "Add at least one required skill.";
  const names = new Set();
  for (const requirement of draft.requirements) {
    if (!catalogSkills.some((s) => s.name === requirement.skill))
      return "Choose skills from the current catalog.";
    if (names.has(requirement.skill))
      return "Each skill can appear only once. Increase its number of people instead.";
    names.add(requirement.skill);
    if (!Number.isInteger(requirement.count) || requirement.count < 1)
      return "Allocate at least one person to every skill.";
  }
  const allocated = draft.requirements.reduce((sum, r) => sum + r.count, 0);
  if (allocated !== draft.headcount)
    return allocated < draft.headcount
      ? `Allocate ${draft.headcount - allocated} more ${draft.headcount - allocated === 1 ? "person" : "people"} to your skills.`
      : `You have allocated ${allocated - draft.headcount} too many people.`;
  return "";
}

export function skillCandidates(
  employees: Employee[],
  requirements: SkillRequirement[],
  onlyAvailable = false,
): CandidateGroup[] {
  return requirements.map((requirement) => ({
    ...requirement,
    candidates: rankMatches(
      employees
        .filter(
          (e) =>
            (!onlyAvailable || e.available) &&
            (e.skills[requirement.skill] || 0) > 0,
        )
        .map((employee) => ({
          employee,
          level: employee.skills[requirement.skill],
          score: employee.skills[requirement.skill] * 20,
        })),
    ),
  }));
}

export function teamSummary(
  draft: ScenarioDraft,
  selections: Selections,
  employees: Employee[],
  catalogSkills: Skill[],
): TeamSummary {
  const error = allocationError(draft, catalogSkills);
  if (error) throw new Error(error);
  const used = new Set();
  const groups = draft.requirements.map((requirement) => {
    const ids = selections[requirement.skill] || [];
    if (ids.length !== requirement.count)
      throw new Error(
        `Choose exactly ${requirement.count} ${requirement.count === 1 ? "person" : "people"} for ${requirement.skill}.`,
      );
    const members = ids.map((id) => {
      if (used.has(id))
        throw new Error("Each person can fill only one place in a scenario.");
      used.add(id);
      const employee = employees.find((e) => e.id === id);
      if (!employee || !employee.skills[requirement.skill])
        throw new Error(
          `A selected person no longer has ${requirement.skill}. Please review your team.`,
        );
      if (draft.onlyAvailable && !employee.available)
        throw new Error(
          "A selected person is no longer available. Please review your team.",
        );
      const { name, role, department, initials, color } = employee;
      const level = employee.skills[requirement.skill];
      return {
        employeeId: id,
        name,
        role,
        department,
        initials,
        color,
        level,
        score: level * 20,
      };
    });
    return {
      ...requirement,
      members,
      averageScore: Math.round(
        members.reduce((sum, m) => sum + m.score, 0) / members.length,
      ),
    };
  });
  const members = groups.flatMap((group) => group.members);
  return {
    headcount: draft.headcount,
    averageScore: Math.round(
      members.reduce((sum, m) => sum + m.score, 0) / members.length,
    ),
    groups,
  };
}

export function uniqueScenarioTitle(
  title: string,
  scenarios: Pick<SavedScenario, "title">[],
) {
  const base = title.trim();
  const used = new Set(
    scenarios.map((s) => s.title.trim().toLocaleLowerCase("en")),
  );
  let candidate = base;
  for (let number = 2; used.has(candidate.toLocaleLowerCase("en")); number++)
    candidate = `${base} (${number})`;
  return candidate;
}
