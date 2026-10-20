import type { ControllerService } from "../../services/controllerService";
import { useControllerData } from "../../hooks/useControllerData";
import ControllerHeader from "./ControllerHeader";
import ControllerHistory from "./ControllerHistory";
import FeedbackController from "./FeedbackController";
import MeetingController from "./MeetingController";
import { dataMode } from "../../lib/supabaseClient";

interface StaffControllerProps {
  service?: ControllerService;
}

export default function StaffController({ service }: StaffControllerProps) {
  const controller = useControllerData(service);
  const { statsState } = controller;

  return (
    <main className="controller-shell">
      <div className="controller-layout">
        <ControllerHeader />
        <div className="controller-intro">
          <p className="controller-kicker">NEW HORIZONS 2026 <span aria-hidden="true">/</span> OPERATIONS</p>
          <p>Two quick actions. One clear record of progress.</p>
        </div>
        {statsState.status === "loading" && (
          <div className="controller-load-state" role="status">Loading {dataMode === "live" ? "event" : "demo"} statistics…</div>
        )}
        {statsState.status === "error" && (
          <div className="controller-load-state" role="alert">
            <p>{dataMode === "live" ? "Event" : "Demo"} statistics could not be loaded. No values have been assumed.</p>
            <button type="button" onClick={controller.loadStats}>Retry loading</button>
          </div>
        )}
        {statsState.status === "ready" && (
          <>
          <div className="controller-cards">
            <MeetingController
              stats={statsState.stats}
              state={controller.meetingState}
              message={controller.meetingMessage}
              onSubmit={controller.submitMeeting}
              retryQuantity={controller.meetingRetryQuantity}
              activeQuantity={controller.meetingActiveQuantity}
            />
            <FeedbackController
              stats={statsState.stats}
              state={controller.feedbackState}
              message={controller.feedbackMessage}
              onSubmit={controller.submitFeedback}
            />
          </div>
          <ControllerHistory
            status={controller.historyState.status}
            actions={controller.historyState.actions}
            undoState={controller.undoState}
            message={controller.undoMessage}
            retryOriginalRequestId={controller.undoRetryOriginalRequestId}
            retryReason={controller.undoRetryReason}
            onUndo={controller.undoAction}
            onRefresh={controller.loadActions}
          />
          </>
        )}
        <p className="controller-footer-note">{dataMode === "live" ? "Authorized event operations · Saved records" : "Development preview · Session-only synthetic data · Refresh resets this controller"}</p>
      </div>
    </main>
  );
}
