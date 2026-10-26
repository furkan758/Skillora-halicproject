import { Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import "../scss/scenario-wizard.scss";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import {
  draftFromPreset,
  editSavedScenario,
  fetchSavedScenarios,
  findScenarioCandidates,
  openSavedScenario,
  savePlannedScenario,
  setPlanningStep,
  startScenario,
} from "../reduxToolKit/scenarioPlanningSlice";
import type { ScenarioDraft, ToastHandler } from "../types";
import BriefStep from "./BriefStep";
import ScenarioLibrary from "./ScenarioLibrary";
import { allocationError, teamSummary } from "./scenarioModel";
import ScenarioStepper from "./ScenarioStepper";
import SummaryStep from "./SummaryStep";
import TeamStep from "./TeamStep";

export default function ScenarioPage({ toast }: { toast: ToastHandler }) {
  const dispatch = useAppDispatch();
  const planning = useAppSelector((s) => s.planning);
  const catalog = useAppSelector((s) => s.catalog);
  const employees = useAppSelector((s) => s.employees.items);
  const mainRef = useRef<HTMLElement>(null);
  const saved = planning.saved.find((s) => s.id === planning.activeSavedId);
  const editing = !!planning.editingScenarioId;
  const viewingSaved = !!saved && !editing;
  useEffect(() => {
    dispatch(fetchSavedScenarios());
  }, [dispatch]);
  let summary = null,
    summaryError = "";
  if (!viewingSaved) {
    try {
      summary = teamSummary(
        planning.draft,
        planning.selections,
        employees,
        catalog.skills,
      );
    } catch (error) {
      summaryError = apiError(error).message;
    }
  }
  const scroll = () =>
    mainRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  const newScenario = (draft?: ScenarioDraft) => {
    dispatch(
      startScenario(
        draft || {
          ...draftFromPreset(),
          requirements: draftFromPreset().requirements.filter((r) =>
            catalog.skills.some((s) => s.name === r.skill),
          ),
        },
      ),
    );
    scroll();
  };
  const find = async () => {
    if (planning.status === "succeeded" && planning.candidates.length) {
      dispatch(setPlanningStep(2));
      scroll();
      return;
    }
    try {
      await dispatch(findScenarioCandidates()).unwrap();
      scroll();
    } catch {
      /* The request error is displayed beside the form. */
    }
  };
  const save = async () => {
    try {
      const record = await dispatch(savePlannedScenario()).unwrap();
      toast(`“${record.title}” ${editing ? "updated" : "saved"} successfully.`);
      scroll();
    } catch {
      /* Keep the chosen team available for retry. */
    }
  };
  const duplicate = () =>
    newScenario({
      client: saved!.client,
      title: saved!.projectTitle,
      description: saved!.description,
      headcount: saved!.headcount,
      onlyAvailable: saved!.onlyAvailable,
      requirements: saved!.requirements.filter((r) =>
        catalog.skills.some((s) => s.name === r.skill),
      ),
    });
  const busy =
    planning.saveStatus === "loading" || planning.status === "loading";
  const activeStep = viewingSaved ? 3 : planning.step;
  const goToStep = async (step: number) => {
    if (busy) return;
    if (viewingSaved) {
      if (step === 3) return;
      dispatch(editSavedScenario(saved.id));
      if (step === 2) {
        try {
          await dispatch(findScenarioCandidates()).unwrap();
        } catch {
          /* Review the restored brief if it is no longer valid. */
        }
      }
    } else if (step === 2) {
      await find();
      return;
    } else dispatch(setPlanningStep(step));
    scroll();
  };
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            THE RIGHT SKILLS. THE RIGHT PEOPLE. ONE TEAM.
          </div>
          <h1>
            Build a team around the brief<span>.</span>
          </h1>
          <p>
            Define the need, choose your people, and see how it all comes
            together.
          </p>
        </div>
        <span className="page-chip">
          <Sparkles size={15} /> Team planning
        </span>
      </section>
      <div className="scenario-workspace">
        <ScenarioLibrary
          planning={planning}
          selectedId={saved?.id}
          busy={busy}
          onNew={() => newScenario()}
          onSelect={(id) => {
            dispatch(openSavedScenario(id));
            scroll();
          }}
        />
        <section
          className="scenario-wizard"
          ref={mainRef}
          aria-label="Scenario builder"
        >
          <ScenarioStepper
            activeStep={activeStep}
            busy={busy}
            canChooseTeam={
              viewingSaved || !allocationError(planning.draft, catalog.skills)
            }
            canReview={viewingSaved || !!summary}
            onStep={goToStep}
          />
          {editing && (
            <div className="scenario-editing">
              <div>
                <strong>Editing {saved?.title}</strong>
                <span>Your saved scenario changes only when you save.</span>
              </div>
              <button
                disabled={busy}
                onClick={() => dispatch(openSavedScenario(saved!.id))}
              >
                Cancel editing <X size={13} />
              </button>
            </div>
          )}
          {planning.notice && (
            <p className="scenario-edit-notice" role="status">
              {planning.notice}
            </p>
          )}
          <div className="wizard-panel">
            {viewingSaved ? (
              <SummaryStep
                draft={saved}
                summary={saved.summary}
                saved={saved}
                onDuplicate={duplicate}
                onEdit={() => goToStep(1)}
              />
            ) : planning.step === 1 ? (
              <BriefStep
                planning={planning}
                catalog={catalog}
                dispatch={dispatch}
                onContinue={find}
              />
            ) : planning.step === 2 ? (
              <TeamStep
                planning={planning}
                dispatch={dispatch}
                onReview={() => {
                  dispatch(setPlanningStep(3));
                  scroll();
                }}
              />
            ) : summary ? (
              <SummaryStep
                draft={planning.draft}
                summary={summary}
                editing={editing}
                saving={busy}
                error={planning.error}
                onSave={save}
                onBack={() => goToStep(2)}
              />
            ) : (
              <div className="wizard-body">
                <p className="error" role="alert">
                  {summaryError}
                </p>
                <button
                  className="button secondary"
                  onClick={() => goToStep(2)}
                >
                  Review selections
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
