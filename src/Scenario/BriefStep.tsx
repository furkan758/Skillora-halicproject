import {
  ArrowRight,
  ClipboardList,
  Globe2,
  Layers3,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { presets } from "../mockDatas/data";
import { progressPercentage } from "../otherComponents/progress";
import "../scss/progress.scss";
import {
  draftFromPreset,
  replaceBrief,
  setDraftField,
  setRequirements,
} from "../reduxToolKit/scenarioPlanningSlice";
import type { AppDispatch } from "../reduxToolKit/store";
import CatalogSkillOptions from "../skills/CatalogSkillOptions";
import type {
  Catalog,
  PlanningState,
  Preset,
  SkillRequirement,
} from "../types";
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
  const update = <K extends keyof SkillRequirement>(
    index: number,
    key: K,
    value: SkillRequirement[K],
  ) =>
    dispatch(
      setRequirements(
        draft.requirements.map((r, i) =>
          i === index ? { ...r, [key]: value } : r,
        ),
      ),
    );
  const applyPreset = (preset: Preset) =>
    dispatch(
      replaceBrief({
        ...draftFromPreset(preset),
        requirements: preset.criteria
          .filter((c) => catalog.skills.some((s) => s.name === c.skill))
          .map((c) => ({ skill: c.skill, count: 1 })),
      }),
    );
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
        <label className="field-label">
          Start with a template <span>Optional</span>
        </label>
        <div className="preset-row">
          {presets.map((preset, i) => {
            const Icon = [Globe2, Layers3, ClipboardList][i];
            return (
              <button
                type="button"
                className="preset"
                key={preset.name}
                onClick={() => applyPreset(preset)}
              >
                <Icon size={16} />
                {preset.name}
              </button>
            );
          })}
        </div>
        <div className="form-grid">
          <label>
            Client name
            <input
              required
              maxLength={80}
              value={draft.client}
              onChange={(e) =>
                field({ field: "client", value: e.target.value })
              }
              placeholder="e.g. OpenAI"
            />
          </label>
          <label>
            Project title
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => field({ field: "title", value: e.target.value })}
              placeholder="e.g. Corporate website"
            />
          </label>
        </div>
        <label className="description-label">
          Project brief
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) =>
              field({ field: "description", value: e.target.value })
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
            value={draft.headcount}
            onChange={(e) =>
              field({ field: "headcount", value: Number(e.target.value) })
            }
          />
        </div>
        <div className="allocation-heading">
          <div>
            <h3>Allocate people to skills</h3>
            <p>Each person fills one place, for one skill.</p>
          </div>
          <span className={allocated === draft.headcount ? "complete" : ""}>
            {allocated} / {draft.headcount} allocated
          </span>
        </div>
        <div
          className="allocation-track"
          data-progress={progressPercentage(allocated, draft.headcount)}
        >
          <span />
        </div>
        <div className="allocation-labels">
          <span>REQUIRED SKILL</span>
          <span>PEOPLE</span>
          <span />
        </div>
        <div className="allocation-rows">
          {draft.requirements.map((r, i) => (
            <div className="allocation-row" key={i}>
              <select
                aria-label={`Required skill ${i + 1}`}
                value={r.skill}
                onChange={(e) => update(i, "skill", e.target.value)}
              >
                {!catalog.skills.some((skill) => skill.name === r.skill) && (
                  <option value={r.skill}>
                    {r.skill} (no longer in catalog)
                  </option>
                )}
                <CatalogSkillOptions
                  folders={catalog.folders}
                  skills={catalog.skills}
                  exclude={draft.requirements
                    .filter((_, index) => index !== i)
                    .map((other) => other.skill)}
                />
              </select>
              <input
                aria-label={`People needed for ${r.skill}`}
                type="number"
                min={1}
                max={100}
                required
                value={r.count}
                onChange={(e) => update(i, "count", Number(e.target.value))}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${r.skill} requirement`}
                onClick={() =>
                  dispatch(
                    setRequirements(
                      draft.requirements.filter((_, index) => i !== index),
                    ),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="add-criterion"
          disabled={draft.requirements.length >= catalog.skills.length}
          onClick={() => {
            const skill = catalog.skills.find(
              (s) => !draft.requirements.some((r) => r.skill === s.name),
            );
            if (skill)
              dispatch(
                setRequirements([
                  ...draft.requirements,
                  { skill: skill.name, count: 1 },
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
            {status === "loading" ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}{" "}
            {status === "loading" ? "Finding candidates..." : "Find candidates"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </>
  );
}
