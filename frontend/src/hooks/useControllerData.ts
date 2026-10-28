import { useEffect, useRef, useState } from "react";
import type { ControllerService } from "../services/controllerService";
import { ControllerConflictError } from "../services/controllerService";
import { mockControllerService } from "../services/mockControllerProvider";
import { liveControllerService } from "../services/liveControllerService";
import { dataMode } from "../lib/supabaseClient";
import type { CheckinStatus, ControllerAction, ControllerStats, Rating, CheckinQuantity, UndoRequest } from "../types/controller";

type StatsState =
  | { status: "loading"; stats: null }
  | { status: "error"; stats: null }
  | { status: "ready"; stats: ControllerStats };

type SubmissionState = "idle" | "pending" | "success" | "error";
type HistoryState = { status: "loading" | "error"; actions: ControllerAction[] } |
  { status: "ready"; actions: ControllerAction[] };

export function useControllerData(service: ControllerService = dataMode === "live" ? liveControllerService : mockControllerService) {
  const [statsState, setStatsState] = useState<StatsState>({ status: "loading", stats: null });
  const [meetingState, setMeetingState] = useState<SubmissionState>("idle");
  const [feedbackState, setFeedbackState] = useState<SubmissionState>("idle");
  const [undoState, setUndoState] = useState<SubmissionState>("idle");
  const [checkinState, setCheckinState] = useState<SubmissionState>("idle");
  const [checkins, setCheckins] = useState<{ status: "loading" | "error" | "ready"; data: CheckinStatus | null }>({ status: "loading", data: null });
  const [historyState, setHistoryState] = useState<HistoryState>({ status: "loading", actions: [] });
  const [meetingMessage, setMeetingMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [undoMessage, setUndoMessage] = useState("");
  const [checkinMessage, setCheckinMessage] = useState("");
  const meetingRequest = useRef<{ requestId: string; quantity: 1 | 2 | 3 } | null>(null);
  const feedbackRequest = useRef<{ requestId: string; rating: Rating } | null>(null);
  const undoRequest = useRef<UndoRequest | null>(null);
  const checkinRequest = useRef<{ requestId: string; quantity?: CheckinQuantity; checkedIn?: number; expectedVersion?: number } | null>(null);
  const meetingPending = useRef(false);
  const feedbackPending = useRef(false);
  const undoPending = useRef(false);
  const checkinPending = useRef(false);
  const historyRead = useRef(0);
  const checkinRead = useRef(0);

  async function loadStats() {
    setStatsState({ status: "loading", stats: null });
    try {
      setStatsState({ status: "ready", stats: await service.getStats() });
    } catch {
      setStatsState({ status: "error", stats: null });
    }
  }

  async function loadActions() {
    const read = ++historyRead.current;
    try {
      const actions = await service.getRecentActions();
      if (read === historyRead.current) {
        setHistoryState({ status: "ready", actions });
        const uncertain = undoRequest.current;
        if (uncertain && actions.some((action) => action.requestId === uncertain.originalRequestId &&
            action.reversedAt !== null || action.operation === "undo" &&
            action.originalRequestId === uncertain?.originalRequestId)) {
          undoRequest.current = null;
          setUndoState("success");
          setUndoMessage("This action is now reversed. The displayed totals are being refreshed.");
          void loadStats();
          void loadCheckins();
        }
      }
    } catch {
      if (read === historyRead.current) setHistoryState((previous) => ({ ...previous, status: "error" }));
    }
  }

  async function loadCheckins() {
    const read = ++checkinRead.current;
    setCheckins((previous) => ({ ...previous, status: "loading" }));
    try {
      const data = await service.getCheckins();
      if (read === checkinRead.current) setCheckins({ status: "ready", data });
    } catch {
      if (read === checkinRead.current) setCheckins((previous) => ({ ...previous, status: "error" }));
    }
  }

  useEffect(() => {
    let active = true;
    const read = ++historyRead.current;
    service.getStats().then(
      (stats) => { if (active) setStatsState({ status: "ready", stats }); },
      () => { if (active) setStatsState({ status: "error", stats: null }); },
    );
    service.getRecentActions().then(
      (actions) => { if (active && read === historyRead.current) setHistoryState({ status: "ready", actions }); },
      () => { if (active && read === historyRead.current) setHistoryState({ status: "error", actions: [] }); },
    );
    return () => { active = false; };
  }, [service]);

  async function submitMeeting(quantity: 1 | 2 | 3 = 1) {
    if (meetingPending.current || statsState.status !== "ready") return;
    if (meetingRequest.current && meetingRequest.current.quantity !== quantity) return;
    meetingPending.current = true;
    meetingRequest.current ??= { requestId: crypto.randomUUID(), quantity };
    setMeetingState("pending");
    setMeetingMessage("");
    try {
      const response = await service.submitMeeting(meetingRequest.current);
      setStatsState({ status: "ready", stats: response.stats });
      meetingRequest.current = null;
      setMeetingState("success");
      setMeetingMessage(`Meeting recorded successfully. Total: ${response.stats.completedMeetings}.`);
      void loadActions();
    } catch {
      setMeetingState("error");
      setMeetingMessage("Meeting was not confirmed. Retry safely with the same submission ID.");
    } finally {
      meetingPending.current = false;
    }
  }

  async function submitFeedback(rating: Rating): Promise<boolean> {
    if (feedbackPending.current || statsState.status !== "ready") return false;
    if (feedbackRequest.current && feedbackRequest.current.rating !== rating) return false;
    feedbackPending.current = true;
    feedbackRequest.current ??= { requestId: crypto.randomUUID(), rating };
    setFeedbackState("pending");
    setFeedbackMessage("");
    try {
      const response = await service.submitFeedback(feedbackRequest.current);
      setStatsState({ status: "ready", stats: response.stats });
      feedbackRequest.current = null;
      setFeedbackState("success");
      setFeedbackMessage(`${rating}-star feedback submitted successfully.`);
      void loadActions();
      return true;
    } catch {
      setFeedbackState("error");
      setFeedbackMessage("Feedback was not confirmed. Retry safely with the same submission ID.");
      return false;
    } finally {
      feedbackPending.current = false;
    }
  }

  async function submitCheckin(quantity: CheckinQuantity = 1) {
    if (checkinPending.current || checkins.status !== "ready" || !checkins.data || checkins.data.mode !== "manual") return;
    if (checkinRequest.current && checkinRequest.current.quantity !== quantity) return;
    checkinPending.current = true;
    checkinRequest.current ??= { requestId: crypto.randomUUID(), quantity };
    setCheckinState("pending");
    setCheckinMessage("");
    try {
      const response = await service.submitCheckin(checkinRequest.current);
      ++checkinRead.current;
      setCheckins({ status: "ready", data: response.checkins });
      checkinRequest.current = null;
      setCheckinState("success");
      setCheckinMessage(`Check-in saved. Total: ${response.checkins.checkedIn}.`);
      void loadActions();
    } catch (error) {
      if (error instanceof ControllerConflictError) checkinRequest.current = null;
      setCheckinState("error");
      setCheckinMessage(error instanceof ControllerConflictError ? error.message : "Check-in was not confirmed. Retry with the same submission ID.");
    } finally {
      checkinPending.current = false;
    }
  }

  async function setExactCheckins(checkedIn: number) {
    const current = checkins.data;
    if (checkinPending.current || checkins.status !== "ready" || !current || current.mode !== "manual" ||
        current.version === undefined || !current.canSetExact) return;
    if (checkinRequest.current && checkinRequest.current.checkedIn !== checkedIn) return;
    checkinPending.current = true;
    checkinRequest.current ??= { requestId: crypto.randomUUID(), checkedIn, expectedVersion: current.version };
    setCheckinState("pending");
    setCheckinMessage("");
    try {
      const request = checkinRequest.current;
      const response = await service.setCheckins({ requestId: request.requestId,
        checkedIn: request.checkedIn!, expectedVersion: request.expectedVersion! });
      ++checkinRead.current;
      setCheckins({ status: "ready", data: response.checkins });
      checkinRequest.current = null;
      setCheckinState("success");
      setCheckinMessage(`Exact check-in total saved: ${response.checkins.checkedIn}.`);
      void loadActions();
    } catch (error) {
      if (error instanceof ControllerConflictError) checkinRequest.current = null;
      setCheckinState("error");
      setCheckinMessage(error instanceof Error ? error.message : "Exact total was not confirmed. Retry safely.");
    } finally {
      checkinPending.current = false;
    }
  }

  async function refreshCheckins() {
    if (checkinPending.current) return;
    await loadCheckins();
  }

  function refreshAfterSettings() {
    if (meetingState === "success") { setMeetingState("idle"); setMeetingMessage(""); }
    if (feedbackState === "success") { setFeedbackState("idle"); setFeedbackMessage(""); }
    if (checkinState === "success") { setCheckinState("idle"); setCheckinMessage(""); }
    if (undoState === "success") { setUndoState("idle"); setUndoMessage(""); }
    void loadStats();
    void loadActions();
    void loadCheckins();
  }

  async function undoAction(originalRequestId: string): Promise<boolean> {
    const original = historyState.actions.find((action) => action.requestId === originalRequestId);
    if (undoPending.current || statsState.status !== "ready" || historyState.status !== "ready" ||
        !original || original.reversedAt !== null || original.undoEligible === false) {
      return false;
    }
    if (undoRequest.current && undoRequest.current.originalRequestId !== originalRequestId) return false;
    undoPending.current = true;
    undoRequest.current ??= { requestId: crypto.randomUUID(), originalRequestId, reason: "other" };
    setUndoState("pending");
    setUndoMessage("Reversing action…");
    try {
      const response = await service.undoAction(undoRequest.current);
      setStatsState({ status: "ready", stats: response.stats });
      if (original.kind === "meeting") {
        setMeetingState("success");
        setMeetingMessage(`Selected meeting action reversed. Total: ${response.stats.completedMeetings}.`);
      } else if (original.kind === "feedback") {
        setFeedbackState("success");
        setFeedbackMessage("Selected rating reversed. Feedback average updated.");
      } else {
        setCheckinState("success");
        setCheckinMessage("Selected check-in reversed.");
        void loadCheckins();
      }
      undoRequest.current = null;
      setUndoState("success");
      setUndoMessage("Correction saved. The original action remains in the audit history.");
      await loadActions();
      return true;
    } catch {
      setUndoState("error");
      setUndoMessage("Correction was not confirmed. Retry this action with the same submission ID.");
      return false;
    } finally {
      undoPending.current = false;
    }
  }

  return {
    statsState,
    meetingState,
    feedbackState,
    undoState,
    checkinState,
    checkins,
    historyState,
    meetingMessage,
    meetingActiveQuantity: meetingRequest.current?.quantity,
    meetingRetryQuantity: meetingState === "error" ? meetingRequest.current?.quantity : undefined,
    feedbackMessage,
    undoMessage,
    checkinMessage,
    checkinRetry: checkinState === "error" ? checkinRequest.current : null,
    undoRetryOriginalRequestId: undoState === "error" ? undoRequest.current?.originalRequestId : undefined,
    loadStats,
    loadActions,
    loadCheckins,
    refreshCheckins,
    refreshAfterSettings,
    submitMeeting,
    submitFeedback,
    submitCheckin,
    setExactCheckins,
    undoAction,
  };
}
