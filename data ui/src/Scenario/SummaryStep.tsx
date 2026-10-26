import {
  ArrowLeft,
  Check,
  CircleHelp,
  Layers3,
  LoaderCircle,
  Plus,
  Save,
  Users,
} from "lucide-react";
import { progressPercentage } from "../otherComponents/progress";
import "../scss/progress.scss";
import type { SavedScenario, ScenarioDraft, TeamSummary } from "../types";
import PersonAvatar from "./PersonAvatar";

export default function SummaryStep({
  draft,
  summary,
  saved,
  editing,
  saving,
  error,
  onSave,
  onBack,
  onDuplicate,
  onEdit,
}: {
  draft: ScenarioDraft;
  summary: TeamSummary;
  saved?: SavedScenario;
  editing?: boolean;
  saving?: boolean;
  error?: string | null;
  onSave?: () => void;
  onBack?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
}) {
  return (
    <>
      <div className="wizard-section-title">
        <span className="number-badge">03</span>
        <div>
          <h2>{saved ? saved.title : "Your team, at a glance"}</h2>
          <p>
            {saved
              ? `${saved.client} · Saved ${new Date(saved.createdAt).toLocaleDateString("en-GB", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", year: "numeric" })}`
              : `${draft.client} · ${draft.title}`}
          </p>
        </div>
        {saved && (
          <span className="saved-badge">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <div className="wizard-body">
        <div className="team-average">
          <div
            className="average-ring"
            data-progress={progressPercentage(summary.averageScore)}
          >
            <strong>
              {summary.averageScore}
              <small>%</small>
            </strong>
          </div>
          <div>
            <span className="eyebrow">THE BIG PICTURE</span>
            <h3>Overall team compatibility</h3>
            <p>
              The average match across your {summary.headcount}-person team,
              based on each person’s assigned skill.
            </p>
            <div className="average-chips">
              <span>
                <Users size={13} /> {summary.headcount} people
              </span>
              <span>
                <Layers3 size={13} /> {summary.groups.length} skills
              </span>
              <span>
                <Check size={13} /> All places filled
              </span>
            </div>
          </div>
        </div>
        <div className="summary-method">
          <CircleHelp size={16} />
          <p>
            Each person’s score is their proficiency in the assigned skill ÷ 5 ×
            100. Your overall average is the sum of all selected scores divided
            by {summary.headcount} people.
          </p>
        </div>
        <div className="summary-groups">
          {summary.groups.map((group) => (
            <section className="summary-group" key={group.skill}>
              <div className="summary-group-heading">
                <h3>
                  {group.skill}
                  <span>
                    {group.count} {group.count === 1 ? "person" : "people"}
                  </span>
                </h3>
                <strong>
                  {group.averageScore}% <small>skill average</small>
                </strong>
              </div>
              <ul>
                {group.members.map((member) => (
                  <li key={member.employeeId}>
                    <PersonAvatar person={member} />
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.role}</span>
                    </div>
                    <span className="summary-level">{member.level}/5</span>
                    <strong className="summary-person-score">
                      {member.score}%
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {draft.description && (
          <div className="saved-brief">
            <h3>Project brief</h3>
            <p>{draft.description}</p>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="wizard-footer">
          {saved ? (
            <>
              <button className="button secondary" onClick={onDuplicate}>
                <Plus size={15} /> Use brief for a new scenario
              </button>
              <button className="button primary" onClick={onEdit}>
                <ArrowLeft size={15} /> Edit scenario
              </button>
            </>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={saving}
                onClick={onBack}
              >
                <ArrowLeft size={15} /> Change selections
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={onSave}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Save size={16} />
                )}{" "}
                {saving
                  ? "Saving scenario..."
                  : editing
                    ? "Save changes"
                    : "Save scenario"}
              </button>
            </>
          )}
        </div>
        {!saved && (
          <p className="selection-helper">
            {editing
              ? "Save changes to update this scenario and its team average."
              : "Saved under your project title. Repeated titles receive (2), (3), and so on."}
          </p>
        )}
      </div>
    </>
  );
}
