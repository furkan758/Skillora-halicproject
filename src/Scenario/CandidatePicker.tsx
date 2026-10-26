import { Check, Plus, Search, Users, X } from "lucide-react";
import { useRef, useState } from "react";
import Pagination, { usePagination } from "../otherComponents/Pagination";
import { toggleCandidate } from "../reduxToolKit/scenarioPlanningSlice";
import type { AppDispatch } from "../reduxToolKit/store";
import type { CandidateGroup, Selections } from "../types";
import PersonAvatar from "./PersonAvatar";

export default function CandidatePicker({
  group,
  selections,
  dispatch,
}: {
  group: CandidateGroup;
  selections: Selections;
  dispatch: AppDispatch;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const selected = selections[group.skill] || [];
  const elsewhere = (id: number) =>
    Object.entries(selections).find(
      ([skill, ids]) => skill !== group.skill && ids.includes(id),
    )?.[0];
  const filtered = group.candidates.filter((c) =>
    `${c.employee.name} ${c.employee.role}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const page = usePagination(filtered, query, 5);
  const recommended = group.candidates.find((c) => !elsewhere(c.employee.id))
    ?.employee.id;
  return (
    <div className="candidate-picker" ref={listRef}>
      <div className="candidate-heading">
        <div>
          <h3>{group.skill}</h3>
          <p>
            Choose {group.count} {group.count === 1 ? "person" : "people"} ·
            Highest skill match first
          </p>
        </div>
        <span className="selection-count">
          {selected.length} / {group.count} selected
        </span>
      </div>
      <label className="search-field candidate-search">
        <Search size={16} />
        <input
          aria-label={`Search ${group.skill} candidates`}
          placeholder="Search people or roles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="candidate-list" aria-label={`${group.skill} candidates`}>
        {page.items.map((candidate) => {
          const e = candidate.employee,
            chosen = selected.includes(e.id),
            usedFor = elsewhere(e.id),
            full = selected.length >= group.count;
          return (
            <li
              className={`candidate-row${chosen ? " selected" : ""}`}
              key={e.id}
            >
              <PersonAvatar person={e} />
              <div className="candidate-person">
                <strong>
                  {e.name}
                  {e.id === recommended && (
                    <span className="recommendation">Top fit</span>
                  )}
                </strong>
                <p>{e.role}</p>
                <small>
                  {usedFor
                    ? `Selected for ${usedFor}`
                    : `${candidate.level}/5 proficiency · ${e.available ? "Available" : "On a project"}`}
                </small>
              </div>
              <div className="candidate-score">
                <strong>
                  {candidate.score}
                  <small>%</small>
                </strong>
                <span>skill match</span>
              </div>
              <button
                className={`button ${chosen ? "selected-choice" : "secondary"}`}
                aria-label={`${chosen ? "Remove" : "Select"} ${e.name} for ${group.skill}`}
                aria-pressed={chosen}
                disabled={!!usedFor || (!chosen && full)}
                onClick={() =>
                  dispatch(
                    toggleCandidate({ skill: group.skill, employeeId: e.id }),
                  )
                }
              >
                {chosen ? <Check size={14} /> : <Plus size={14} />}{" "}
                {chosen
                  ? "Selected"
                  : usedFor
                    ? "Assigned"
                    : full
                      ? "Full"
                      : "Select"}
              </button>
            </li>
          );
        })}
      </ul>
      {!page.total && (
        <div className="catalog-empty">
          <Users size={27} />
          <h3>No matching candidates</h3>
          <p>
            {group.candidates.length
              ? "Try a different name."
              : "No eligible team member has this skill. Go back to adjust your requirements or availability filter."}
          </p>
        </div>
      )}
      <Pagination pagination={page} label="Candidates" scrollTarget={listRef} />
      {selected.length > 0 && (
        <div className="selected-people">
          <span>YOUR SELECTION</span>
          {selected.map((id) => {
            const candidate = group.candidates.find(
              (c) => c.employee.id === id,
            );
            return (
              candidate && (
                <button
                  key={id}
                  onClick={() =>
                    dispatch(
                      toggleCandidate({ skill: group.skill, employeeId: id }),
                    )
                  }
                >
                  {candidate.employee.name}
                  <X size={12} />
                </button>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}
