import type { Employee } from "../types";

export default function PersonAvatar({
  person,
}: {
  person: Pick<Employee, "initials" | "color">;
}) {
  return (
    <span className={`avatar ${person.color} tiny`}>{person.initials}</span>
  );
}
