import type { LucideIcon } from "lucide-react";
import { cx } from "./classNames";

export default function Stat({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  color: string;
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={cx("stat-icon", color)}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
