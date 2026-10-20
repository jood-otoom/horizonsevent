import type { ControllerStats } from "../../types/controller";

interface MeetingControllerProps {
  stats: ControllerStats;
  state: "idle" | "pending" | "success" | "error";
  message: string;
  onSubmit: (quantity: 1 | 2 | 3) => void;
  retryQuantity?: 1 | 2 | 3;
  activeQuantity?: 1 | 2 | 3;
}

export default function MeetingController({ stats, state, message, onSubmit, retryQuantity, activeQuantity }: MeetingControllerProps) {
  return (
    <section className="controller-card" aria-labelledby="match-heading">
      <div className="controller-card-heading">
        <span className="controller-pillar-number">01 / MATCH</span>
        <h2 id="match-heading">Completed Meetings</h2>
        <p>Record a meeting once it has finished.</p>
      </div>
      <div className="controller-meeting-total">
        <span className="controller-total-label">{stats.dataMode === "mock" ? "Meetings recorded this demo session" : "Meetings recorded for this event"}</span>
        <strong aria-label={`${stats.completedMeetings} completed meetings`}>
          {stats.completedMeetings.toLocaleString()}
        </strong>
      </div>
      <div className="controller-meeting-actions">
        {([1, 2, 3] as const).map((quantity) => (
          <button className="controller-action" key={quantity} type="button"
            onClick={() => onSubmit(quantity)}
            disabled={state === "pending" || (retryQuantity !== undefined && retryQuantity !== quantity)}>
            <span aria-hidden="true">+</span> {state === "pending" && activeQuantity === quantity ? "Recording…" : `${quantity} Meeting${quantity === 1 ? "" : "s"}`}
          </button>
        ))}
      </div>
      <p className={`controller-message controller-message-${state}`} role="status" aria-live="polite">
        {message || (stats.dataMode === "mock" ? "Each tap creates synthetic meeting records." : "Record completed meetings only.")}
      </p>
    </section>
  );
}
