import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "../scss/scenario-wizard.scss";
import ConfirmAction from "../otherComponents/ConfirmAction";
import ScenarioActions from "./ScenarioActions";
import RequestFeedback from "../otherComponents/RequestFeedback";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { fetchWorkspace } from "../reduxToolKit/store";
import {
  editSavedScenario,
  hydrateDraftScenario,
  copyDraftAsNew,
  fetchSavedScenarios,
  findScenarioCandidates,
  openSavedScenario,
  savePlannedScenario,
  setPlanningStep,
  startScenario,
} from "../reduxToolKit/scenarioPlanningSlice";
import type { ToastHandler } from "../types";
import BriefStep from "./BriefStep";
import ScenarioLibrary from "./ScenarioLibrary";
import {
  allocationError,
  hasScenarioDraftChanges,
  savedDraft,
  savedSummary,
  teamSummary,
} from "./scenarioModel";
import ScenarioStepper from "./ScenarioStepper";
import SummaryStep from "./SummaryStep";
import TeamStep from "./TeamStep";
export default function ScenarioPage({ toast }: { toast: ToastHandler }) {
  const dispatch = useAppDispatch();
  const planning = useAppSelector((s) => s.planning);
  const catalog = useAppSelector((s) => s.catalog);
  const ref = useRef<HTMLElement>(null);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const saved = planning.activeScenario;
  const editing = planning.editingScenarioId !== null;
  const viewingSaved = !!saved && !editing;
  const busy =
    planning.saveStatus === "loading" || planning.status === "loading";
  useEffect(() => {
    const timer = setTimeout(() => dispatch(fetchSavedScenarios()), 180);
    return () => clearTimeout(timer);
  }, [
    dispatch,
    planning.saved.page,
    planning.libraryQuery,
    planning.libraryStatus,
  ]);
  useEffect(() => {
    if (planning.editingScenarioId && !planning.activeScenario)
      dispatch(hydrateDraftScenario(planning.editingScenarioId));
  }, [dispatch, planning.editingScenarioId, planning.activeScenario]);
  const navigateWithDraftCheck = (action: () => void) => {
    const d = planning.draft;
    if (
      !viewingSaved &&
      (planning.editingScenarioId !== null || hasScenarioDraftChanges(d))
    )
      setPendingNavigation(() => action);
    else action();
  };
  let summary = null,
    summaryError = "";
  if (!viewingSaved) {
    try {
      summary = teamSummary(
        planning.draft,
        planning.selections,
        catalog.skills,
      );
    } catch (error) {
      summaryError = apiError(error).message;
    }
  }
  const scroll = () =>
    ref.current?.scrollIntoView({ block: "start", behavior: "instant" });
  const find = async () => {
    try {
      await dispatch(findScenarioCandidates()).unwrap();
      scroll();
    } catch {
      /* Form displays the request error. */
    }
  };
  const review = async () => {
    try {
      const selections = await dispatch(findScenarioCandidates()).unwrap();
      teamSummary(planning.draft, selections, catalog.skills);
      dispatch(setPlanningStep(3));
      scroll();
    } catch (error) {
      toast(apiError(error).message);
    }
  };
  const goToStep = async (step: number) => {
    if (busy || (viewingSaved && saved.status === "ARCHIVED")) return;
    if (viewingSaved) {
      if (step === 3) return;
      try {
        await dispatch(editSavedScenario(saved.id)).unwrap();
        if (step === 2) await dispatch(findScenarioCandidates()).unwrap();
      } catch {
        /* Keep errors visible and preserve the original saved scenario. */
      }
    } else if (step === 2) {
      await find();
      return;
    } else if (step === 3) {
      await review();
      return;
    } else dispatch(setPlanningStep(step));
    scroll();
  };
  const save = async () => {
    try {
      const record = await dispatch(savePlannedScenario()).unwrap();
      toast('"' + record.projectTitle + '" saved in SQL Server.');
      scroll();
    } catch {
      /* The API error stays next to the save action. */
    }
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
      <RequestFeedback
        status={catalog.status}
        error={catalog.error}
        onRetry={() => dispatch(fetchWorkspace())}
      />
      <div className="scenario-workspace">
        <ScenarioLibrary
          planning={planning}
          selectedId={saved?.id}
          busy={busy}
          onNew={() =>
            navigateWithDraftCheck(() => {
              dispatch(startScenario());
              scroll();
            })
          }
          onSelect={(id) =>
            navigateWithDraftCheck(() => {
              dispatch(openSavedScenario(id));
              scroll();
            })
          }
        />
        <section
          className="scenario-wizard"
          ref={ref}
          aria-label="Scenario builder"
        >
          <ScenarioStepper
            activeStep={viewingSaved ? 3 : planning.step}
            busy={busy}
            canChooseTeam={
              viewingSaved
                ? saved.status !== "ARCHIVED"
                : !allocationError(planning.draft, catalog.skills)
            }
            canReview={viewingSaved || !!summary}
            onStep={goToStep}
          />
          {editing && (
            <div className="scenario-editing">
              <div>
                <strong>Editing {saved?.projectTitle}</strong>
                <span>The saved record changes only when you save.</span>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  if (planning.editingScenarioId)
                    dispatch(openSavedScenario(planning.editingScenarioId));
                }}
              >
                Cancel editing <X size={13} />
              </button>
            </div>
          )}
          {planning.draftStorageError && (
            <p className="error wizard-body" role="alert">
              {planning.draftStorageError}
            </p>
          )}
          {!viewingSaved && (
            <p className="draft-note wizard-draft-note">
              Unsaved changes are kept in this tab. SQL records change only when
              you save.
            </p>
          )}
          {editing && (
            <button
              className="button secondary draft-copy"
              disabled={busy}
              onClick={() => dispatch(copyDraftAsNew())}
            >
              Save this draft as a new scenario
            </button>
          )}
          {viewingSaved && (
            <ScenarioActions record={saved} busy={busy} toast={toast} />
          )}
          {planning.notice && (
            <p className="scenario-edit-notice" role="status">
              {planning.notice}
            </p>
          )}
          {planning.status === "loading" && (
            <RequestFeedback status="loading" />
          )}
          {viewingSaved && planning.error && (
            <p className="error wizard-body" role="alert">
              {planning.error}
            </p>
          )}
          {planning.errorCode === "stale_scenario" && saved && (
            <div className="scenario-edit-notice" role="alert">
              <p>
                This scenario has a newer saved version. Reload it to review the
                latest team before editing again.
              </p>
              <button
                className="button secondary"
                onClick={() => dispatch(openSavedScenario(saved.id))}
              >
                Reload latest saved scenario
              </button>
            </div>
          )}
          <div className="wizard-panel">
            {viewingSaved ? (
              <SummaryStep
                draft={savedDraft(saved)}
                summary={savedSummary(saved)}
                saved={saved}
                onDuplicate={() => {
                  dispatch(startScenario(savedDraft(saved)));
                  scroll();
                }}
                onEdit={
                  saved.status === "ARCHIVED" ? undefined : () => goToStep(1)
                }
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
                onReview={review}
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
      {pendingNavigation && (
        <ConfirmAction
          title="Discard unsaved scenario?"
          label="Discard and continue"
          onClose={() => setPendingNavigation(null)}
          onConfirm={async () => {
            pendingNavigation();
          }}
        >
          <p>
            Your draft is saved in this tab. Continuing will replace it. Save
            the scenario first if you want to keep it.
          </p>
        </ConfirmAction>
      )}
    </>
  );
}
