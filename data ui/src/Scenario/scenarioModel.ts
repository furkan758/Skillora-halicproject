import type {
  Candidate,
  SavedScenario,
  ScenarioDraft,
  Selections,
  Skill,
  TeamSummary,
} from "../types";
export const blankDraft = (): ScenarioDraft => ({
  clientName: "",
  projectTitle: "",
  projectBrief: "",
  requiredPeople: 1,
  requirements: [],
  onlyAvailable: true,
});
export function hasScenarioDraftChanges(draft: ScenarioDraft): boolean {
  const initial = blankDraft();
  return (
    draft.clientName !== initial.clientName ||
    draft.projectTitle !== initial.projectTitle ||
    draft.projectBrief !== initial.projectBrief ||
    draft.requiredPeople !== initial.requiredPeople ||
    draft.onlyAvailable !== initial.onlyAvailable ||
    draft.requirements.length > 0
  );
}
export function allocationError(draft: ScenarioDraft, skills: Skill[]) {
  if (!draft.projectTitle.trim()) return "Enter a project title.";
  if (!draft.clientName.trim()) return "Enter a client name.";
  if (
    !Number.isInteger(draft.requiredPeople) ||
    draft.requiredPeople < 1 ||
    draft.requiredPeople > 100
  )
    return "Choose a team size between 1 and 100.";
  if (!draft.requirements.length) return "Add at least one required skill.";
  const ids = new Set<number>();
  for (const r of draft.requirements) {
    if (!skills.some((s) => s.id === r.skillId))
      return "Choose skills from the current catalog.";
    if (ids.has(r.skillId)) return "Each skill can appear only once.";
    ids.add(r.skillId);
    if (!Number.isInteger(r.count) || r.count < 1 || r.count > 100)
      return "Allocate between 1 and 100 people to each skill.";
  }
  const count = draft.requirements.reduce((sum, r) => sum + r.count, 0);
  if (count !== draft.requiredPeople)
    return count < draft.requiredPeople
      ? `Allocate ${draft.requiredPeople - count} more people to your skills.`
      : `You have allocated ${count - draft.requiredPeople} too many people.`;
  return "";
}
export function scenarioPayload(
  draft: ScenarioDraft,
  selections: Selections,
  expectedVersion: number | null,
) {
  return {
    ...draft,
    assignments: draft.requirements.flatMap((r) =>
      (selections[r.skillId] || []).map((c) => ({
        employeeId: c.employee.id,
        skillId: r.skillId,
      })),
    ),
    ...(expectedVersion !== null ? { expectedVersion } : {}),
  };
}
export function teamSummary(
  draft: ScenarioDraft,
  selections: Selections,
  skills: Skill[],
): TeamSummary {
  const error = allocationError(draft, skills);
  if (error) throw new Error(error);
  const used = new Set<number>();
  const groups = draft.requirements.map((r) => {
    const selected = selections[r.skillId] || [];
    const skillName = skills.find((s) => s.id === r.skillId)!.name;
    if (selected.length !== r.count)
      throw new Error(`Choose exactly ${r.count} people for ${skillName}.`);
    const members = selected.map((c: Candidate) => {
      if (used.has(c.employee.id))
        throw new Error("Each person can fill only one place.");
      used.add(c.employee.id);
      return {
        employeeId: c.employee.id,
        firstName: c.employee.firstName,
        lastName: c.employee.lastName,
        name: c.employee.name,
        department: c.employee.department,
        jobTitle: c.employee.jobTitle,
        level: c.proficiencyLevel,
        score: c.compatibility,
      };
    });
    return {
      ...r,
      skillName,
      members,
      averageScore: Math.round(
        members.reduce((sum, m) => sum + m.score, 0) / members.length,
      ),
    };
  });
  const members = groups.flatMap((g) => g.members);
  return {
    headcount: draft.requiredPeople,
    averageScore: Math.round(
      members.reduce((sum, m) => sum + m.score, 0) / members.length,
    ),
    groups,
  };
}
export function savedSummary(record: SavedScenario): TeamSummary {
  return {
    headcount: record.selectedPeople,
    averageScore: record.averageCompatibility ?? 0,
    groups: record.requirements.map((r) => {
      const members = record.assignments
        .filter((a) => a.skillId === r.skillId)
        .map((a) => ({
          employeeId: a.employeeId,
          firstName: a.firstName,
          lastName: a.lastName,
          name: a.firstName + " " + a.lastName,
          department: a.department,
          jobTitle: a.jobTitle,
          level: a.proficiencyAtSelection,
          score: a.compatibility,
        }));
      return {
        ...r,
        members,
        averageScore: members.length
          ? Math.round(
              members.reduce((sum, m) => sum + m.score, 0) / members.length,
            )
          : 0,
      };
    }),
  };
}
export function savedDraft(record: SavedScenario): ScenarioDraft {
  return {
    clientName: record.clientName,
    projectTitle: record.baseTitle,
    projectBrief: record.projectBrief,
    requiredPeople: record.requiredPeople,
    onlyAvailable: record.onlyAvailable,
    requirements: record.requirements.map(({ skillId, count }) => ({
      skillId,
      count,
    })),
  };
}
