import {
  Download,
  Plus,
  Layers3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "../scss/list-views.scss";
import { cx } from "../otherComponents/classNames";
import Pagination from "../otherComponents/Pagination";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { pageControls } from "../otherComponents/serverPage";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import {
  clearFilters,
  fetchEmployees,
  fetchWorkspace,
  setAvailability,
  setDepartment,
  setEmployeePage,
  setQuery,
} from "../reduxToolKit/store";
import SkillCatalog from "../skills/SkillCatalog";
import type { Employee, ToastHandler } from "../types";
import {
  getActiveForm,
  removeDraft,
  formDraftKey,
} from "../otherComponents/draftStorage";
import ConfirmAction from "../otherComponents/ConfirmAction";
import { deleteEmployee } from "../reduxToolKit/store";
import EmployeeList from "./EmployeeList";

export default function TalentDirectory({
  onEdit,
  toast,
}: {
  onEdit: (employee: Employee | "new") => void;
  toast: ToastHandler;
}) {
  const dispatch = useAppDispatch();
  const people = useAppSelector((s) => s.employees);
  const catalog = useAppSelector((s) => s.catalog);
  const { items, query, department, availability, status, error, page } =
    people;
  const [tab, setTab] = useState(() =>
    getActiveForm("catalog") ? "skills" : "people",
  );
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const directoryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => dispatch(fetchEmployees()), 180);
    return () => clearTimeout(timer);
  }, [dispatch, query, department, availability, page]);
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "skillora-team-page-" + page + ".json";
    link.click();
    URL.revokeObjectURL(url);
    toast("The current team page was exported.");
  };
  return (
    <section className="directory" ref={directoryRef}>
      <div className="section-heading">
        <div>
          <h2>
            Your talent directory{" "}
            <span>{catalog.overview.employeeCount} members</span>
          </h2>
          <p>A little expertise. A lot of possibilities.</p>
        </div>
        {tab === "people" && (
          <div className="directory-actions">
            <button className="button primary" onClick={() => onEdit("new")}>
              <Plus size={17} /> Add team member
            </button>
            <button
              className="button secondary export-button"
              onClick={exportData}
              disabled={status !== "succeeded"}
            >
              <Download size={15} /> Export page
            </button>
          </div>
        )}
      </div>
      <div className="directory-tabs">
        <div>
          <button
            className={cx(tab === "people" && "active")}
            onClick={() => setTab("people")}
          >
            <Users size={16} /> Team members
          </button>
          <button
            className={cx(tab === "skills" && "active")}
            onClick={() => setTab("skills")}
          >
            <Layers3 size={16} /> Skills overview
          </button>
        </div>
        <span className="updated">
          <span /> Database workspace
        </span>
      </div>
      <RequestFeedback
        status={catalog.status}
        error={catalog.error}
        onRetry={() => dispatch(fetchWorkspace())}
      />
      {tab === "people" ? (
        <>
          <div className="filter-bar">
            <label className="search-field">
              <Search size={17} />
              <input
                maxLength={200}
                aria-label="Search team members or skills"
                placeholder="Search people, roles, or skills..."
                value={query}
                onChange={(e) => dispatch(setQuery(e.target.value))}
              />
              {query && (
                <button
                  aria-label="Clear search"
                  onClick={() => dispatch(setQuery(""))}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="filter-select">
              <SlidersHorizontal size={15} />
              <select
                aria-label="Filter by department"
                value={department}
                onChange={(e) => dispatch(setDepartment(e.target.value))}
              >
                <option value="All">All departments</option>
                {catalog.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-select availability-filter">
              <span className="filter-dot" />
              <select
                aria-label="Filter by availability"
                value={availability}
                onChange={(e) => dispatch(setAvailability(e.target.value))}
              >
                <option value="All">Availability</option>
                <option>Available</option>
                <option value="Busy">On a project</option>
              </select>
            </div>
          </div>
          <RequestFeedback
            status={status}
            error={error}
            onRetry={() => dispatch(fetchEmployees())}
          />
          {status === "succeeded" && (
            <>
              <div className="results-line">
                <span>{people.total} team members matching your filters</span>
                <span>Name A–Z</span>
              </div>
              {!items.length ? (
                <div className="empty-state">
                  <Search size={30} />
                  <h3>No team members found</h3>
                  <p>Add a member or try another name, skill, or department.</p>
                  <button
                    className="button secondary"
                    onClick={() => dispatch(clearFilters())}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <EmployeeList
                  employees={items}
                  onEdit={onEdit}
                  onDelete={setDeleting}
                />
              )}
              <Pagination
                pagination={pageControls(people, (next) =>
                  dispatch(setEmployeePage(next)),
                )}
                label="Team members"
                scrollTarget={directoryRef}
              />
            </>
          )}
        </>
      ) : (
        <SkillCatalog toast={toast} />
      )}
      {deleting && (
        <ConfirmAction
          title="Remove team member?"
          label="Remove member"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await dispatch(deleteEmployee(deleting.id)).unwrap();
            removeDraft(formDraftKey("employee", deleting.id));
            toast("Team member removed. Saved scenario history was preserved.");
          }}
        >
          <p>
            Remove {deleting.name} from the active team? Their active skills
            will also be removed. Saved scenario scores remain available.
          </p>
        </ConfirmAction>
      )}
      <div className="directory-footer">
        <span>
          <ShieldCheck size={14} /> A shared view of what makes your team
          extraordinary.
        </span>
        <span>Made for people. Built for possibility.</span>
      </div>
    </section>
  );
}
