import type { Employee } from "../types";
import { cx } from "./classNames";
import { initials } from "../skillsToEmp/employeeProfile";
export default function Avatar({
  employee,
  size = "",
}: {
  employee: Pick<Employee, "firstName" | "lastName">;
  size?: string;
}) {
  return (
    <span className={cx("avatar", "sage", size)}>{initials(employee)}</span>
  );
}
