import { useAuth } from "../lib/auth";
import { useOnboarding } from "../lib/onboarding";
import type { UserRole } from "../data/types";

/** What each role is actually meant to do first. Written as the tasks an officer has on day one,
 *  not as a feature list — a tour of the buttons teaches nothing about the work. */
const firstTasks: Record<UserRole, { step: string; detail: string }[]> = {
  investigator: [
    {
      step: "Open a case from your caseload",
      detail:
        "The console then narrows to that investigation. Filters, the entity you had in focus and your position on the timeline are all restored the next time you open it.",
    },
    {
      step: "Work the network",
      detail:
        "The graph shows how people, organisations, vehicles, phones and places connect. Selecting an entity pulls its record, its links and the evidence each link rests on.",
    },
    {
      step: "Print the dossier",
      detail:
        "Every case produces a dossier for the file. A redacted copy is available for material that leaves the department.",
    },
  ],
  supervisor: [
    {
      step: "Review the oversight console",
      detail:
        "Caseload across the unit, which investigations are moving, and where officers are carrying more than they should.",
    },
    {
      step: "Assign and reassign cases",
      detail: "Cases carry a lead officer and a supporting team. Both are set from oversight.",
    },
    {
      step: "Clear the merge queue",
      detail:
        "Records that look like the same person are held for a decision rather than merged automatically. Nothing is combined without an officer approving it.",
    },
  ],
};

export default function FirstRunDialog() {
  const { role, officerId } = useAuth();
  const { introOpen, closeIntro, startTour } = useOnboarding();

  if (!introOpen) return null;

  const tasks = firstTasks[role];

  return (
    <div className="ftue-backdrop" role="dialog" aria-modal="true" aria-labelledby="ftue-title">
      <div className="ftue-dialog">
        <div className="ftue-head">
          <div className="ftue-eyebrow">
            {officerId ? `${officerId} · ` : ""}
            {role === "supervisor" ? "Supervisor" : "Investigator"}
          </div>
          <h2 className="ftue-title" id="ftue-title">
            Before you start
          </h2>
          <p className="ftue-lede">
            NETRA brings the records already held on a case &mdash; statements, call detail, financial
            trails, vehicle sightings and camera hits &mdash; into one network you can read. It does
            not decide anything. Every link it draws names the evidence it came from, so it can be
            checked, argued with, and put in front of a court.
          </p>
        </div>

        <ol className="ftue-steps">
          {tasks.map(({ step, detail }, i) => (
            <li key={step} className="ftue-step">
              <span className="ftue-step-num mono">{i + 1}</span>
              <div>
                <div className="ftue-step-title">{step}</div>
                <p className="ftue-step-detail">{detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="ftue-foot">
          <span className="ftue-foot-note">
            You can reopen this from the help control in the top bar.
          </span>
          <div className="ftue-actions">
            <button type="button" className="ftue-btn" onClick={closeIntro}>
              Skip
            </button>
            <button type="button" className="ftue-btn ftue-btn-primary" onClick={startTour}>
              Show me around
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
