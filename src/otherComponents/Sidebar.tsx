import {
  ArrowUpRight,
  CircleHelp,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Page } from "../types";
import Brand from "./Brand";
import { cx } from "./classNames";

export default function Sidebar({
  page,
  mobileOpen,
  teamCount,
  onNavigate,
  onClose,
  onHelp,
}: {
  page: Page;
  mobileOpen: boolean;
  teamCount: number;
  onNavigate: (page: Page) => void;
  onClose: () => void;
  onHelp: () => void;
}) {
  return (
    <>
      <aside className={cx("sidebar", mobileOpen && "open")}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-logo">
            a<span>✳</span>
          </span>
          <div>
            <strong>Acme Studio</strong>
            <span>Team workspace</span>
          </div>
          <span className="workspace-tag">PRO</span>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          <button
            onClick={() => onNavigate("skills")}
            className={cx("nav-item", page === "skills" && "active")}
          >
            <Users size={19} /> Skills{" "}
            <span className="nav-pill">{teamCount}</span>
          </button>
          <button
            onClick={() => onNavigate("scenarios")}
            className={cx("nav-item", page === "scenarios" && "active")}
          >
            <GitBranch size={19} /> Scenarios{" "}
            <span className="nav-new">NEW</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={20} />
          </span>
          <h3>Talent meets opportunity.</h3>
          <p>
            Your next great project starts with the people you already have.
          </p>
          <button onClick={() => onNavigate("scenarios")}>
            Create a scenario <ArrowUpRight size={15} />
          </button>
          <div className="note-decoration" />
        </div>
        <div className="sidebar-bottom">
          <button className="help-link" onClick={onHelp}>
            <CircleHelp size={18} /> Help & getting started{" "}
            <ArrowUpRight size={14} />
          </button>
          <div className="account">
            <span className="account-avatar">JD</span>
            <div>
              <strong>Jamie Davis</strong>
              <span>Workspace admin</span>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
    </>
  );
}
