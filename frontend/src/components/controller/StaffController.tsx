import type { ControllerService } from "../../services/controllerService";
import { useControllerData } from "../../hooks/useControllerData";
import { useState } from "react";
import ControllerHeader from "./ControllerHeader";
import ControllerHistory from "./ControllerHistory";
import CheckinController from "./CheckinController";
import FeedbackController from "./FeedbackController";
import MeetingController from "./MeetingController";
import { dataMode } from "../../lib/supabaseClient";

interface StaffControllerProps {
  service?: ControllerService;
}

export default function StaffController({ service }: StaffControllerProps) {
  const controller = useControllerData(service);
  const { statsState } = controller;
  const [checkinsOpen, setCheckinsOpen] = useState(false);

  return (
    <main className="controller-shell">
      <div className="controller-layout">
        <ControllerHeader />
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
          {checkinsOpen ? (
            <CheckinController status={controller.checkins} state={controller.checkinState}
              message={controller.checkinMessage} reconcileState={controller.reconcileState}
              reconcileMessage={controller.reconcileMessage} onSubmit={controller.submitCheckin}
              onReconcile={controller.reconcileCheckins} onRefresh={controller.loadCheckins}
              onHide={() => setCheckinsOpen(false)} />
          ) : (
            <button className="controller-checkin-toggle controller-secondary-action" type="button"
              onClick={() => { setCheckinsOpen(true); void controller.loadCheckins(); }}>
              Check-ins Controller
            </button>
          )}
          <ControllerHistory
            status={controller.historyState.status}
            actions={controller.historyState.actions}
            undoState={controller.undoState}
            message={controller.undoMessage}
            retryOriginalRequestId={controller.undoRetryOriginalRequestId}
            onUndo={controller.undoAction}
            onRefresh={controller.loadActions}
          />
          </>
        )}
      </div>
    </main>
  );
}
