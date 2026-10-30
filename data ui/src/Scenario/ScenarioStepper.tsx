import { Check, ChevronRight } from "lucide-react";

interface Props {
  activeStep: number;
  busy: boolean;
  canChooseTeam: boolean;
  canReview: boolean;
  onStep: (step: number) => void;
}
const steps = [
  { name: "Build your scenario", caption: "The brief" },
  { name: "Choose your team", caption: "The people" },
  { name: "Review & save", caption: "The big picture" },
];
export default function ScenarioStepper({
  activeStep,
  busy,
  canChooseTeam,
  canReview,
  onStep,
}: Props) {
  return (
    <div className="wizard-steps" aria-label="Scenario steps">
      {steps.map((step, i) => (
        <button
          type="button"
          disabled={
            busy || (i === 1 && !canChooseTeam) || (i === 2 && !canReview)
          }
          aria-current={activeStep === i + 1 ? "step" : undefined}
          className={`${activeStep === i + 1 ? "active " : ""}${activeStep > i + 1 ? "done" : ""}`}
          key={step.name}
          onClick={() => onStep(i + 1)}
        >
          <span>{activeStep > i + 1 ? <Check size={15} /> : `0${i + 1}`}</span>
          <div>
            <strong>{step.name}</strong>
            <small>{step.caption}</small>
          </div>
          {i < 2 && <ChevronRight size={14} />}
        </button>
      ))}
    </div>
  );
}
