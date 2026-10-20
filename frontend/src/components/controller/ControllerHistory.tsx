import { useState } from "react";
import type { ControllerAction, CorrectionReason } from "../../types/controller";

interface ControllerHistoryProps {
  status: "loading" | "ready" | "error";
  actions: ControllerAction[];
  undoState: "idle" | "pending" | "success" | "error";
  message: string;
  retryOriginalRequestId?: string;
  retryReason?: CorrectionReason;
  onUndo: (originalRequestId: string, reason: CorrectionReason) => Promise<boolean>;
  onRefresh: () => void;
}

function actionLabel(action: ControllerAction) {
  return action.kind === "meeting"
    ? `+${action.quantity} meeting${action.quantity === 1 ? "" : "s"}`
    : `${action.rating}-star rating`;
}

export default function ControllerHistory({ status, actions, undoState, message,
  retryOriginalRequestId, retryReason, onUndo, onRefresh }: ControllerHistoryProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState<CorrectionReason | "">("");
  const selectedAction = actions.find((action) => action.requestId === selected);

  async function confirmUndo() {
    if (!selectedAction || !reason) return;
    if (await onUndo(selectedAction.requestId, reason)) {
      setSelected(null);
      setReason("");
    }
  }

  return (
    <section className="controller-history" aria-labelledby="controller-history-heading">
      <div className="controller-history-heading">
        <div>
          <span className="controller-pillar-number">RECENT OPERATIONS</span>
          <h2 id="controller-history-heading">Action history & corrections</h2>
          <p>Undo reverses one selected submission. Its original record stays in the audit trail.</p>
        </div>
        <button className="controller-secondary-action" type="button" onClick={onRefresh}
          disabled={undoState === "pending"}>Refresh actions</button>
      </div>
      {status === "loading" && <p role="status">Loading recent actions…</p>}
      {status === "error" && <p role="alert">Recent actions could not be loaded. Try refreshing them.</p>}
      {status === "ready" && actions.length === 0 && <p>No actions recorded yet.</p>}
      {status === "ready" && actions.length > 0 && (
        <ol className="controller-history-list">
          {actions.map((action) => (
            <li key={action.requestId}>
              <div>
                <strong>{actionLabel(action)}</strong>
                <span>{new Date(action.createdAt).toLocaleString()}</span>
              </div>
              {action.reversedAt
                ? <span className="controller-reversed">Reversed</span>
                : <button className="controller-secondary-action" type="button"
                  disabled={undoState === "pending" || !!retryOriginalRequestId && retryOriginalRequestId !== action.requestId}
                  onClick={() => { setSelected(action.requestId); setReason(retryReason ?? ""); }}>
                  Undo
                </button>}
            </li>
          ))}
        </ol>
      )}
      {selectedAction && !selectedAction.reversedAt && (
        <div className="controller-correction" role="group" aria-label="Confirm correction">
          <p>Undo {actionLabel(selectedAction)} from {new Date(selectedAction.createdAt).toLocaleString()}?</p>
          <label htmlFor="correction-reason">Reason</label>
          <select id="correction-reason" value={reason}
            disabled={undoState === "pending" || !!retryOriginalRequestId}
            onChange={(event) => setReason(event.target.value as CorrectionReason | "")}>
            <option value="">Choose a reason</option>
            <option value="duplicate">Duplicate entry</option>
            {selectedAction.kind === "meeting"
              ? <option value="wrong_count">Wrong meeting count</option>
              : <option value="wrong_rating">Wrong rating</option>}
            <option value="other">Other correction</option>
          </select>
          <div className="controller-correction-actions">
            <button className="controller-action" type="button" onClick={confirmUndo}
              disabled={!reason || undoState === "pending"}>
              {undoState === "pending" ? "Saving correction…" : undoState === "error" ? "Retry undo" : "Confirm undo"}
            </button>
            <button className="controller-secondary-action" type="button"
              disabled={undoState === "pending" || !!retryOriginalRequestId}
              onClick={() => { setSelected(null); setReason(""); }}>Cancel</button>
          </div>
        </div>
      )}
      <p className={`controller-message controller-message-${undoState}`} role="status" aria-live="polite">
        {selectedAction && undoState === "success" ? "" : message}
      </p>
    </section>
  );
}
