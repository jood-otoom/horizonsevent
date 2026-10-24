import { useState } from "react";
import type { CheckinStatus } from "../../types/controller";

interface CheckinControllerProps {
  status: { status: "loading" | "error" | "ready"; data: CheckinStatus | null };
  state: "idle" | "pending" | "success" | "error";
  message: string;
  reconcileState: "idle" | "pending" | "success" | "error";
  reconcileMessage: string;
  onSubmit: () => void;
  onReconcile: () => void;
  onRefresh: () => void;
  onHide: () => void;
}

export default function CheckinController({ status, state, message, reconcileState,
  reconcileMessage, onSubmit, onReconcile, onRefresh, onHide }: CheckinControllerProps) {
  const [reviewing, setReviewing] = useState(false);
  const data = status.data;
  const atCapacity = data?.registered !== null && data?.checkedIn !== null &&
    data?.registered === data?.checkedIn;

  return (
    <section className="controller-card controller-checkin" aria-labelledby="checkin-heading">
      <div className="controller-checkin-heading">
        <h2 id="checkin-heading">CHECK-INS Controller</h2>
        <button className="controller-secondary-action" type="button" onClick={onHide}>Hide</button>
      </div>
      {status.status === "loading" && <p role="status">Loading check-ins…</p>}
      {status.status === "error" && <p role="alert">Check-ins are unavailable. <button type="button" onClick={onRefresh}>Retry</button></p>}
      {status.status === "ready" && data && <>
        <p className="controller-checkin-total">Checked in <strong>{data.checkedIn?.toLocaleString() ?? "—"}</strong>
          <span>of {data.registered?.toLocaleString() ?? "—"} registered</span></p>
        <button className="controller-action controller-checkin-submit" type="button"
          disabled={state === "pending" || reconcileState === "pending" || data.checkedIn === null || atCapacity}
          onClick={onSubmit}>{state === "pending" ? "Saving…" : state === "error" ? "Retry +1 check-in" : "+1 Check-in"}</button>
        <p className={`controller-message controller-message-${state}`} role="status" aria-live="polite">{message}</p>
        {data.mode === "manual" && <p className="controller-checkin-source">Manual count is displayed. New API measurements stay separate until reviewed.</p>}
        {data.canReconcile && <div className="controller-reconciliation">
          <p>API now reports <strong>{data.apiCheckedIn}</strong>; display shows <strong>{data.checkedIn}</strong>. Verify the API count in b2match before switching.</p>
          {reviewing ? <div className="controller-correction-actions">
            <button className="controller-action" type="button" disabled={state === "pending" || reconcileState === "pending"}
              onClick={() => { onReconcile(); setReviewing(false); }}>
              {reconcileState === "pending" ? "Switching…" : "Confirm verified API count"}</button>
            <button className="controller-secondary-action" type="button" onClick={() => setReviewing(false)}>Cancel</button>
          </div> : <button className="controller-secondary-action" type="button" disabled={state === "pending"}
            onClick={() => setReviewing(true)}>Review API count</button>}
        </div>}
        <p className={`controller-message controller-message-${reconcileState}`} role="status" aria-live="polite">{reconcileMessage}</p>
      </>}
    </section>
  );
}
