import { ArrowLeft, ArrowRight, Check, Users } from "lucide-react";
import { useState } from "react";
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
  const [activeSkill, setActiveSkill] = useState(
    planning.draft.requirements[0]?.skill,
  );
  const group =
    planning.candidates.find((g) => g.skill === activeSkill) ||
    planning.candidates[0];
  const selectedCount = Object.values(planning.selections).reduce(
    (sum, ids) => sum + ids.length,
    0,
  );
  const complete = planning.draft.requirements.every(
    (r) => (planning.selections[r.skill] || []).length === r.count,
  );
  return (
    <>
      <div className="wizard-section-title">
        <span className="number-badge">02</span>
        <div>
          <h2>Choose your team</h2>
          <p>The best fit for each skill. The final choice is yours.</p>
        </div>
        <span className="selection-count">
          {selectedCount} / {planning.draft.headcount} people
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
            const count = planning.selections[r.skill]?.length || 0;
            return (
              <button
                key={r.skill}
                className={`${group?.skill === r.skill ? "active " : ""}${count === r.count ? "filled" : ""}`}
                aria-label={`Choose candidates for ${r.skill}`}
                aria-pressed={group?.skill === r.skill}
                onClick={() => setActiveSkill(r.skill)}
              >
                {r.skill}
                <span>
                  {count === r.count && <Check size={11} />} {count}/{r.count}
                </span>
              </button>
            );
          })}
        </div>
        {group && (
          <CandidatePicker
            key={group.skill}
            group={group}
            selections={planning.selections}
            dispatch={dispatch}
          />
        )}
        <div className="wizard-footer">
          <button
            className="button secondary"
            onClick={() => dispatch(setPlanningStep(1))}
          >
            <ArrowLeft size={15} /> Edit brief
          </button>
          <button
            className="button primary"
            disabled={!complete}
            onClick={onReview}
          >
            Review team average <ArrowRight size={16} />
          </button>
        </div>
        {!complete && (
          <p className="selection-helper">
            Fill every skill’s allocation to continue.{" "}
            {planning.draft.headcount - selectedCount} places remaining.
          </p>
        )}
      </div>
    </>
  );
}
