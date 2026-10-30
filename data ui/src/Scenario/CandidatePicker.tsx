import { Check, Plus, Users, X } from "lucide-react";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Pagination from "../otherComponents/Pagination";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { apiError } from "../otherComponents/errors";
import { emptyPage, pageControls } from "../otherComponents/serverPage";
import { toggleCandidate } from "../reduxToolKit/scenarioPlanningSlice";
import type { AppDispatch } from "../reduxToolKit/store";
import type {
  Candidate,
  PageResult,
  RequestStatus,
  Selections,
  SkillRequirement,
} from "../types";
import PersonAvatar from "./PersonAvatar";
export default function CandidatePicker({
  requirement,
  skillName,
  onlyAvailable,
  selections,
  dispatch,
  busy,
}: {
  requirement: SkillRequirement;
  skillName: string;
  onlyAvailable: boolean;
  selections: Selections;
  dispatch: AppDispatch;
  busy: boolean;
}) {
  const { skillId, count } = requirement;
  const excluded = Object.entries(selections)
    .filter(([id]) => Number(id) !== skillId)
    .flatMap(([, people]) => people.map((c) => c.employee.id))
    .sort((a, b) => a - b);
  const key = JSON.stringify({
    skillId,
    onlyAvailable,
    excludedEmployeeIds: excluded,
  });
  const [choice, setChoice] = useState({ key, page: 1 });
  const page = choice.key === key ? choice.page : 1;
  const [result, setResult] = useState<PageResult<Candidate>>(emptyPage(5));
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = selections[skillId] || [];
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    api
      .post<PageResult<Candidate>>(
        "/scenarios/candidates",
        { ...JSON.parse(key), page },
        { signal: controller.signal },
      )
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, data.totalPages)) {
          setChoice({ key, page: Math.max(1, data.totalPages) });
          return;
        }
        setResult(data);
        setStatus("succeeded");
      })
      .catch((error) => {
        if (controller.signal.aborted || axios.isCancel(error)) return;
        setError(apiError(error).message);
        setStatus("failed");
      });
    return () => controller.abort();
  }, [key, page, retry]);
  const toggle = (candidate: Candidate) =>
    dispatch(toggleCandidate({ skillId, candidate }));
  return (
    <div className="candidate-picker" ref={ref}>
      <div className="candidate-heading">
        <div>
          <h3>{skillName}</h3>
          <p>Choose {count} people · Highest compatibility first</p>
        </div>
        <span className="selection-count">
          {selected.length} / {count} selected
        </span>
      </div>
      <RequestFeedback
        status={status}
        error={error}
        onRetry={() => setRetry((n) => n + 1)}
      />
      {status === "succeeded" && (
        <>
          <ul className="candidate-list" aria-label={skillName + " candidates"}>
            {result.items.map((candidate, index) => {
              const e = candidate.employee,
                chosen = selected.some((c) => c.employee.id === e.id);
              return (
                <li
                  className={"candidate-row" + (chosen ? " selected" : "")}
                  key={e.id}
                >
                  <PersonAvatar person={e} />
                  <div className="candidate-person">
                    <strong>
                      {e.name}
                      {page === 1 && index === 0 && (
                        <span className="recommendation">Top fit</span>
                      )}
                    </strong>
                    <p>{e.jobTitle}</p>
                    <small>
                      {candidate.proficiencyLevel}/5 proficiency ·{" "}
                      {e.isAvailable ? "Available" : "On a project"}
                    </small>
                  </div>
                  <div className="candidate-score">
                    <strong>
                      {candidate.compatibility}
                      <small>%</small>
                    </strong>
                    <span>skill match</span>
                  </div>
                  <button
                    className={
                      "button " + (chosen ? "selected-choice" : "secondary")
                    }
                    aria-label={
                      (chosen ? "Remove " : "Select ") +
                      e.name +
                      " for " +
                      skillName
                    }
                    aria-pressed={chosen}
                    disabled={busy || (!chosen && selected.length >= count)}
                    onClick={() => toggle(candidate)}
                  >
                    {chosen ? <Check size={14} /> : <Plus size={14} />}
                    {chosen
                      ? "Selected"
                      : selected.length >= count
                        ? "Full"
                        : "Select"}
                  </button>
                </li>
              );
            })}
          </ul>
          {!result.total && (
            <div className="catalog-empty">
              <Users size={27} />
              <h3>No eligible candidates</h3>
              <p>
                Adjust the required skill or availability filter. People
                selected for another skill are excluded.
              </p>
            </div>
          )}
          <Pagination
            pagination={pageControls(result, (next) =>
              setChoice({ key, page: next }),
            )}
            label="Candidates"
            scrollTarget={ref}
          />
        </>
      )}
      {!!selected.length && (
        <div className="selected-people">
          <span>YOUR SELECTION</span>
          {selected.map((candidate) => (
            <button
              key={candidate.employee.id}
              aria-label={"Remove selected " + candidate.employee.name}
              disabled={busy}
              onClick={() => toggle(candidate)}
            >
              {candidate.employee.name}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
