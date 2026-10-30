import {
  ArrowRight,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { progressPercentage } from "../otherComponents/progress";
import "../scss/progress.scss";
import {
  setDraftField,
  setRequirements,
} from "../reduxToolKit/scenarioPlanningSlice";
import type { AppDispatch } from "../reduxToolKit/store";
import CatalogSkillOptions from "../skills/CatalogSkillOptions";
import type { Catalog, PlanningState } from "../types";
import { allocationError } from "./scenarioModel";
export default function BriefStep({
  planning,
  catalog,
  dispatch,
  onContinue,
}: {
  planning: PlanningState;
  catalog: Catalog;
  dispatch: AppDispatch;
  onContinue: () => void;
}) {
  const { draft, status, error } = planning;
  const allocated = draft.requirements.reduce(
    (sum, r) => sum + (Number(r.count) || 0),
    0,
  );
  const validation = allocationError(draft, catalog.skills);
  const field = (change: Parameters<typeof setDraftField>[0]) =>
    dispatch(setDraftField(change));
  return (
    <>
      <div className="wizard-section-title">
        <span className="number-badge">01</span>
        <div>
          <h2>Build your scenario</h2>
          <p>Start with the brief. Give every skill its place.</p>
        </div>
      </div>
      <form
        className="wizard-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validation) onContinue();
        }}
      >
        <div className="form-grid">
          <label>
            Client name
            <input
              required
              maxLength={150}
              value={draft.clientName}
              onChange={(e) =>
                field({ field: "clientName", value: e.target.value })
              }
              placeholder="e.g. Aster Studio"
            />
          </label>
          <label>
            Project title
            <input
              required
              maxLength={200}
              value={draft.projectTitle}
              onChange={(e) =>
                field({ field: "projectTitle", value: e.target.value })
              }
              placeholder="e.g. Corporate website"
            />
          </label>
        </div>
        <label className="description-label">
          Project brief
          <textarea
            rows={3}
            maxLength={20000}
            value={draft.projectBrief}
            onChange={(e) =>
              field({ field: "projectBrief", value: e.target.value })
            }
            placeholder="What would your client like to create?"
          />
        </label>
        <div className="team-size-field">
          <span className="stat-icon green">
            <Users size={19} />
          </span>
          <label>
            How many people do you need?
            <small>Distribute this number across the skills below.</small>
          </label>
          <input
            aria-label="Requested team size"
            type="number"
            min={1}
            max={100}
            required
            value={draft.requiredPeople}
            onChange={(e) =>
              field({ field: "requiredPeople", value: Number(e.target.value) })
            }
          />
        </div>
        <div className="allocation-heading">
          <div>
            <h3>Allocate people to skills</h3>
            <p>Each person fills one place, for one skill.</p>
          </div>
          <span
            className={allocated === draft.requiredPeople ? "complete" : ""}
          >
            {allocated} / {draft.requiredPeople} allocated
          </span>
        </div>
        <div
          className="allocation-track"
          data-progress={progressPercentage(allocated, draft.requiredPeople)}
        >
          <span />
        </div>
        <div className="allocation-labels">
          <span>REQUIRED SKILL</span>
          <span>PEOPLE</span>
          <span />
        </div>
        <div className="allocation-rows">
          {draft.requirements.map((r, index) => {
            const name =
              catalog.skills.find((s) => s.id === r.skillId)?.name ||
              "Retired skill";
            return (
              <div className="allocation-row" key={index}>
                <select
                  aria-label={"Required skill " + (index + 1)}
                  value={r.skillId}
                  onChange={(e) =>
                    dispatch(
                      setRequirements(
                        draft.requirements.map((other, i) =>
                          i === index
                            ? { ...other, skillId: Number(e.target.value) }
                            : other,
                        ),
                      ),
                    )
                  }
                >
                  {!catalog.skills.some((s) => s.id === r.skillId) && (
                    <option value={r.skillId}>
                      Retired skill — select a replacement
                    </option>
                  )}
                  <CatalogSkillOptions
                    folders={catalog.folders}
                    skills={catalog.skills}
                    exclude={draft.requirements
                      .filter((_, i) => i !== index)
                      .map((other) => other.skillId)}
                  />
                </select>
                <input
                  aria-label={"People needed for " + name}
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={r.count}
                  onChange={(e) =>
                    dispatch(
                      setRequirements(
                        draft.requirements.map((other, i) =>
                          i === index
                            ? { ...other, count: Number(e.target.value) }
                            : other,
                        ),
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Remove " + name + " requirement"}
                  onClick={() =>
                    dispatch(
                      setRequirements(
                        draft.requirements.filter((_, i) => i !== index),
                      ),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="add-criterion"
          disabled={draft.requirements.length >= catalog.skills.length}
          onClick={() => {
            const skill = catalog.skills.find(
              (s) => !draft.requirements.some((r) => r.skillId === s.id),
            );
            if (skill)
              dispatch(
                setRequirements([
                  ...draft.requirements,
                  { skillId: skill.id, count: 1 },
                ]),
              );
          }}
        >
          <Plus size={16} /> Add another skill
        </button>
        {validation && (
          <p className="allocation-validation" role="status">
            {validation}
          </p>
        )}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.onlyAvailable}
            onChange={(e) =>
              field({ field: "onlyAvailable", value: e.target.checked })
            }
          />
          <span>
            Only show available team members
            <small>Match people who are ready for a new project.</small>
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="wizard-footer">
          <p>
            <ShieldCheck size={14} /> One person. One place. A balanced team.
          </p>
          <button
            className="button primary"
            disabled={!!validation || status === "loading"}
          >
            {status === "loading" && (
              <LoaderCircle size={16} className="spin" />
            )}{" "}
            Find candidates <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </>
  );
}
