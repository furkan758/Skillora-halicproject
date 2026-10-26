import type { Employee } from "../types";
import { cx } from "./classNames";

export default function Avatar({
  employee,
  size = "",
}: {
  employee: Pick<Employee, "color" | "initials">;
  size?: string;
}) {
  return (
    <span className={cx("avatar", employee.color, size)}>
      {employee.initials}
    </span>
  );
}
