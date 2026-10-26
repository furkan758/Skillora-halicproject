import {
  Download,
  Layers3,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import "../scss/list-views.scss";
import { departmentOptions } from "../mockDatas/data";
import { cx } from "../otherComponents/classNames";
import Pagination, { usePagination } from "../otherComponents/Pagination";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import {
  clearFilters,
  fetchEmployees,
  setAvailability,
  setDepartment,
  setQuery,
} from "../reduxToolKit/store";
import SkillCatalog from "../skills/SkillCatalog";
import type { Employee, ToastHandler } from "../types";
import EmployeeList from "./EmployeeList";

export default function TalentDirectory({
  onEdit,
  toast,
}: {
  onEdit: (employee: Employee | "new") => void;
  toast: ToastHandler;
}) {
  const dispatch = useAppDispatch();
  const { items, query, department, availability, status, error } =
    useAppSelector((s) => s.employees);
  const [tab, setTab] = useState("people");
  const [sort, setSort] = useState("default");
  const directoryRef = useRef<HTMLElement>(null);
  const filtered = items
    .filter(
      (e) =>
        (!query ||
          `${e.name} ${e.role} ${Object.keys(e.skills).join(" ")}`
            .toLocaleLowerCase("en")
            .includes(query.toLocaleLowerCase("en"))) &&
        (department === "All" || e.department === department) &&
        (availability === "All" ||
          e.available === (availability === "Available")),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "en")
        : sort === "experience"
          ? b.experience - a.experience
          : a.id - b.id,
    );
  const peoplePage = usePagination(
    filtered,
    JSON.stringify([query, department, availability, sort]),
  );
  const exportData = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "skillora-team.json";
    link.click();
    URL.revokeObjectURL(url);
    toast("Team data exported successfully.");
  };
  return (
    <section className="directory" ref={directoryRef}>
      <div className="section-heading">
        <div>
          <h2>
            Your talent directory <span>{items.length} members</span>
          </h2>
          <p>A little expertise. A lot of possibilities.</p>
        </div>
        <button className="button secondary export-button" onClick={exportData}>
          <Download size={15} /> Export
        </button>
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
          <span /> All changes saved
        </span>
      </div>
      {tab === "people" && (
        <div className="filter-bar">
          <label className="search-field">
            <Search size={17} />
            <input
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
              {departmentOptions.map((name) => (
                <option key={name}>{name}</option>
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
      )}
      {status === "loading" && (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Getting to know your team...
        </div>
      )}
      {status === "failed" && (
        <div className="empty-state">
          <p role="alert">{error}</p>
          <button
            className="button secondary"
            onClick={() => dispatch(fetchEmployees())}
          >
            Try again
          </button>
        </div>
      )}
      {status === "succeeded" &&
        (tab === "people" ? (
          <>
            <div className="results-line">
              <span>
                {filtered.length} team{" "}
                {filtered.length === 1 ? "member" : "members"}
                {filtered.length !== items.length
                  ? ` matching your filters · ${items.length} total`
                  : " in your workspace"}
              </span>
              <label>
                Sort by:{" "}
                <select
                  aria-label="Sort team members"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="default">Default order</option>
                  <option value="name">Name A–Z</option>
                  <option value="experience">Experience</option>
                </select>
              </label>
            </div>
            {!filtered.length ? (
              <div className="empty-state">
                <Search size={30} />
                <h3>No team members found</h3>
                <p>Try another name, skill, or department.</p>
                <button
                  className="button secondary"
                  onClick={() => dispatch(clearFilters())}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <EmployeeList employees={peoplePage.items} onEdit={onEdit} />
            )}
            <Pagination
              pagination={peoplePage}
              label="Team members"
              scrollTarget={directoryRef}
            />
          </>
        ) : (
          <SkillCatalog toast={toast} />
        ))}
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
