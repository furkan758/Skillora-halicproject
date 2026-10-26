import { ArrowRight, GitBranch, ShieldCheck, Users } from "lucide-react";
import Dialog from "./Dialog";

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="A little guidance, a lot of possibility."
      subtitle="Get to know your new talent workspace."
      onClose={onClose}
    >
      <div className="help-content">
        <div>
          <Users />
          <h3>1. Get to know your team</h3>
          <p>
            Add members, record their skills, and set proficiency from 1
            (beginner) to 5 (expert). Edit any profile using its edit button.
          </p>
        </div>
        <div>
          <GitBranch />
          <h3>2. Find a project’s perfect fit</h3>
          <p>
            Open Scenarios, set the team size, and allocate people to skills.
            Choose candidates for each skill, review the team average, and save
            the scenario under its project title.
          </p>
        </div>
        <div>
          <ShieldCheck />
          <h3>Your prototype workspace</h3>
          <p>
            This frontend uses demo API responses. Team edits are saved in this
            browser. Authentication and shared server storage are not connected
            yet.
          </p>
        </div>
        <button className="button primary" onClick={onClose}>
          Let’s get started <ArrowRight size={16} />
        </button>
      </div>
    </Dialog>
  );
}
