import { cx } from "./classNames";

export default function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={cx("brand", small && "small")}>
      <span className="brand-mark">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        skillora<span className="brand-period">.</span>
      </span>
    </div>
  );
}
