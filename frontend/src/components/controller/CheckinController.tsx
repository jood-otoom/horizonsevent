import { useState } from "react";
import type { CheckinQuantity, CheckinStatus } from "../../types/controller";

interface CheckinControllerProps {
  status: { status: "loading" | "error" | "ready"; data: CheckinStatus | null };
  state: "idle" | "pending" | "success" | "error";
  message: string;
  retry: { quantity?: CheckinQuantity; checkedIn?: number } | null;
  onSubmit: (quantity: CheckinQuantity) => void;
  onSetExact: (checkedIn: number) => void;
  onRefresh: () => void;
  onHide: () => void;
}

export default function CheckinController({ status, state, message, retry,
  onSubmit, onSetExact, onRefresh, onHide }: CheckinControllerProps) {
  const [exact, setExact] = useState("");
  const data = status.data;
  const pending = state === "pending";
  const manual = data?.mode === "manual";
  const validExact = /^\d+$/.test(exact) && Number.isSafeInteger(Number(exact)) &&
    data?.registered !== null && Number(exact) <= Number(data?.registered);

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
        <p className="controller-checkin-source">Source: {data.source ?? data.mode}. Manual fallback: {manual ? "active" : "inactive"}.</p>
        {!manual && <p>Activate Manual Mode in Settings before entering check-ins. An event administrator must confirm this permanent switch.</p>}
        <div className="controller-checkin-actions">
          {([1, 2, 5, 10] as const).map(quantity => (
            <button className="controller-action" type="button" key={quantity}
              disabled={pending || !manual || data.checkedIn === null || data.registered === null ||
                data.checkedIn + quantity > data.registered || !!retry && retry.quantity !== quantity}
              onClick={() => onSubmit(quantity)}>
              {pending && retry?.quantity === quantity ? "Saving…" : `+${quantity} Check-in${quantity === 1 ? "" : "s"}`}
            </button>
          ))}
        </div>
        {pending && <p role="status">Saving check-ins…</p>}
        {data.canSetExact && <form className="controller-exact-form" onSubmit={event => {
          event.preventDefault();
          if (validExact && !pending) onSetExact(Number(exact));
        }}>
          <label htmlFor="exact-checkins">Exact checked-in total</label>
          <input id="exact-checkins" type="number" inputMode="numeric" min="0" step="1"
            max={data.registered ?? undefined} value={exact}
            disabled={pending || !manual || !!retry} onChange={event => setExact(event.target.value)} />
          <button className="controller-secondary-action" type="submit"
            disabled={pending || !manual || !validExact || !!retry && retry.checkedIn !== Number(exact)}>
            {retry?.checkedIn !== undefined ? "Retry exact total" : "Set exact total"}
          </button>
          <small>Replaces the total. If another operator changes it, refresh and review before submitting again.</small>
        </form>}
        <p className={`controller-message controller-message-${state}`} role="status" aria-live="polite">{message}</p>
        <button className="controller-secondary-action" type="button" disabled={pending} onClick={onRefresh}>Refresh latest totals</button>
      </>}
    </section>
  );
}
