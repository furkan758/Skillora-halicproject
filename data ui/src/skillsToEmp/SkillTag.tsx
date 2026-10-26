import { cx } from "../otherComponents/classNames";

export default function SkillTag({
  name,
  level,
}: {
  name: string;
  level?: number;
}) {
  return (
    <span
      className={cx(
        "skill-tag",
        ["React", "TypeScript", "JavaScript", "Next.js"].includes(name) &&
          "technical",
      )}
    >
      {name}
      {level && <span className="tag-level">{level}</span>}
    </span>
  );
}
