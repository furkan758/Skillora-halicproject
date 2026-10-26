import { Bell, CheckCheck, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import type { Page } from "../types";

export default function Topbar({
  page,
  onMenu,
}: {
  page: Page;
  onMenu: () => void;
}) {
  const [notice, setNotice] = useState(false);
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu size={21} />
        </button>
        <span>Workspace</span>
        <ChevronRight size={13} />
        <strong>{page === "skills" ? "Skills" : "Scenarios"}</strong>
      </div>
      <div className="topbar-right">
        <span className="prototype-badge">
          <i /> Preview workspace
        </span>
        <button
          className="notification-button icon-button"
          aria-label="View notifications"
          onClick={() => setNotice(!notice)}
        >
          <Bell size={18} />
          <i />
        </button>
        <span className="topbar-divider" />
        <span className="account-avatar small-avatar">JD</span>
      </div>
      {notice && (
        <div className="notifications">
          <div>
            <strong>You’re all caught up</strong>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setNotice(false)}
            >
              <X size={15} />
            </button>
          </div>
          <p>
            Your workspace is ready. Add your team’s skills and create your
            first scenario.
          </p>
          <span>
            <CheckCheck size={14} /> No new notifications
          </span>
        </div>
      )}
    </header>
  );
}
