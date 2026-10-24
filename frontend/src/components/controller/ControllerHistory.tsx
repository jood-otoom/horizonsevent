import type { ControllerAction } from "../../types/controller";

interface ControllerHistoryProps {
  status: "loading" | "ready" | "error";
  actions: ControllerAction[];
  undoState: "idle" | "pending" | "success" | "error";
  message: string;
  retryOriginalRequestId?: string;
  onUndo: (originalRequestId: string) => Promise<boolean>;
  onRefresh: () => void;
}

function actionLabel(action: ControllerAction) {
  if (action.operation === "reconcile") return `Use verified API count ${action.value}`;
  if (action.operation === "undo") return `Undo ${action.kind === "meeting"
    ? `+${action.quantity} meeting${action.quantity === 1 ? "" : "s"}`
    : action.kind === "feedback" ? `${action.rating}-star rating` : "+1 check-in"}`;
  return action.kind === "checkin" ? "+1 check-in" : action.kind === "meeting"
    ? `+${action.quantity} meeting${action.quantity === 1 ? "" : "s"}`
    : `${action.rating}-star rating`;
}

export default function ControllerHistory({ status, actions, undoState, message,
  retryOriginalRequestId, onUndo, onRefresh }: ControllerHistoryProps) {
  const recent = [...actions].sort((a, b) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.requestId.localeCompare(a.requestId)).slice(0, 5);

  return (
    <details className="controller-history">
      <summary>Action History <span>{recent.length > 0 ? recent.length : ""}</span></summary>
      <button className="controller-secondary-action controller-history-refresh" type="button" onClick={onRefresh}
        disabled={undoState === "pending"}>Refresh</button>
      {status === "loading" && <p role="status">Loading recent actions…</p>}
      {status === "error" && <p role="alert">Recent actions could not be loaded. Try refreshing them.</p>}
      {status === "ready" && recent.length === 0 && <p>No actions recorded yet.</p>}
      {status === "ready" && recent.length > 0 && (
        <ol className="controller-history-list">
          {recent.map((action) => (
            <li key={action.requestId}>
              <div>
                <strong>{action.kind === "meeting" ? "MATCH" : action.kind === "feedback" ? "GROW" : "CHECK-IN"} · {actionLabel(action)}</strong>
                <span>{new Date(action.createdAt).toLocaleString("en-US", { timeZone: "Asia/Amman" })}</span>
              </div>
              {action.reversedAt
                ? <span className="controller-reversed">Reversed</span>
                : action.undoEligible === false ? null
                : <button className="controller-secondary-action" type="button"
                  disabled={undoState === "pending" || !!retryOriginalRequestId && retryOriginalRequestId !== action.requestId}
                  onClick={() => { void onUndo(action.requestId); }}>
                  {retryOriginalRequestId === action.requestId ? "Retry undo" : "Undo"}
                </button>}
            </li>
          ))}
        </ol>
      )}
      <p className={`controller-message controller-message-${undoState}`} role="status" aria-live="polite">
        {message}
      </p>
    </details>
  );
}
