import type { Employee, Gender } from "../types";

export const genderOptions: readonly Gender[] = [
  "Not specified",
  "Female",
  "Male",
  "Prefer not to say",
];

type LegacyEmployee = Omit<Employee, "firstName" | "lastName" | "gender"> &
  Partial<Pick<Employee, "firstName" | "lastName" | "gender">>;

export function employeeFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function normalizeEmployee(employee: LegacyEmployee): Employee {
  const name = employee.name.trim().replace(/\s+/g, " ");
  const parts = name.split(" ");
  const structuredName = employeeFullName(
    employee.firstName ?? "",
    employee.lastName ?? "",
  );
  const keepStructuredName =
    typeof employee.firstName === "string" &&
    typeof employee.lastName === "string" &&
    (!name || structuredName === name);
  const firstName = keepStructuredName
    ? employee.firstName!.trim()
    : parts.length > 1
      ? parts.slice(0, -1).join(" ")
      : name;
  const lastName = keepStructuredName
    ? employee.lastName!.trim()
    : parts.length > 1
      ? parts.at(-1)!
      : "";

  return {
    ...employee,
    firstName,
    lastName,
    name: employeeFullName(firstName, lastName),
    // Older profiles have no gender value. Do not infer one from a person's name.
    gender: genderOptions.includes(employee.gender as Gender)
      ? employee.gender!
      : "Not specified",
  };
}
