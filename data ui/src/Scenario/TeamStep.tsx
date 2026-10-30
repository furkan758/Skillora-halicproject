import { ArrowLeft, ArrowRight, Check, Users } from "lucide-react";
import { useState } from "react";
import { useAppSelector } from "../reduxToolKit/hooks";
import { setPlanningStep } from "../reduxToolKit/scenarioPlanningSlice";
import type { AppDispatch } from "../reduxToolKit/store";
import type { PlanningState } from "../types";
import CandidatePicker from "./CandidatePicker";
export default function TeamStep({
  planning,
  dispatch,
  onReview,
}: {
  planning: PlanningState;
  dispatch: AppDispatch;
  onReview: () => void;
}) {
  const [activeId, setActiveId] = useState(
    planning.draft.requirements[0]?.skillId,
  );
  const skills = useAppSelector((s) => s.catalog.skills);
  const requirement =
    planning.draft.requirements.find((r) => r.skillId === activeId) ||
    planning.draft.requirements[0];
  const selectedCount = Object.values(planning.selections).flat().length;
  const complete = planning.draft.requirements.every(
    (r) => (planning.selections[r.skillId] || []).length === r.count,
  );
  const name = (id: number) =>
    skills.find((s) => s.id === id)?.name || "Retired skill";
  return (
    <>
      <div className="wizard-section-title">
        <span className="number-badge">02</span>
        <div>
          <h2>Choose your team</h2>
          <p>The best fit for each skill. The final choice is yours.</p>
        </div>
        <span className="selection-count">
          {selectedCount} / {planning.draft.requiredPeople} people
        </span>
      </div>
      <div className="wizard-body">
        <div className="team-choice-hint">
          <Users size={18} />
          <p>
            Choose people for each skill. A team member can fill{" "}
            <strong>one place only</strong>, even if they match several skills.
          </p>
        </div>
        <div className="role-tabs" aria-label="Required skill allocations">
          {planning.draft.requirements.map((r) => {
            const count = planning.selections[r.skillId]?.length || 0;
            return (
              <button
                key={r.skillId}
                className={
                  (requirement?.skillId === r.skillId ? "active " : "") +
                  (count === r.count ? "filled" : "")
                }
                aria-label={"Choose candidates for " + name(r.skillId)}
                aria-pressed={requirement?.skillId === r.skillId}
                onClick={() => setActiveId(r.skillId)}
                disabled={planning.status === "loading"}
              >
                {name(r.skillId)}
                <span>
                  {count === r.count && <Check size={11} />} {count}/{r.count}
                </span>
              </button>
            );
          })}
        </div>
        {requirement && (
          <CandidatePicker
            key={requirement.skillId}
            requirement={requirement}
            skillName={name(requirement.skillId)}
            onlyAvailable={planning.draft.onlyAvailable}
            selections={planning.selections}
            dispatch={dispatch}
            busy={planning.status === "loading"}
          />
        )}
        {planning.error && (
          <p className="error" role="alert">
            {planning.error}
          </p>
        )}
        <div className="wizard-footer">
          <button
            className="button secondary"
            onClick={() => dispatch(setPlanningStep(1))}
            disabled={planning.status === "loading"}
          >
            <ArrowLeft size={15} /> Edit brief
          </button>
          <button
            className="button primary"
            disabled={!complete || planning.status === "loading"}
            onClick={onReview}
          >
            Review team average <ArrowRight size={16} />
          </button>
        </div>
        {!complete && (
          <p className="selection-helper">
            Fill every skill's allocation to continue.{" "}
            {planning.draft.requiredPeople - selectedCount} places remaining.
          </p>
        )}
      </div>
    </>
  );
}
