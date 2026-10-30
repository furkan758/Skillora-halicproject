import type { Employee, EmployeeInput, Gender } from "../types";
export const genderOptions: readonly Gender[] = [
  "Not specified",
  "Female",
  "Male",
  "Prefer not to say",
];
export function employeeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
export function employeeInput(employee: Employee): EmployeeInput {
  return {
    id: employee.id,
    expectedVersion: employee.version,
    firstName: employee.firstName,
    lastName: employee.lastName,
    departmentId: employee.departmentId,
    jobTitle: employee.jobTitle,
    gender: employee.gender,
    isAvailable: employee.isAvailable,
    skills: employee.skills.map(
      ({ skillId, proficiencyLevel, experienceYears }) => ({
        skillId,
        proficiencyLevel,
        experienceYears,
      }),
    ),
  };
}
export function initials(person: { firstName: string; lastName: string }) {
  return `${person.firstName[0] || ""}${person.lastName[0] || ""}`.toLocaleUpperCase(
    "en",
  );
}
