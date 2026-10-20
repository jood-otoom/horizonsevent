import { useEffect, useRef, useState } from "react";
import type { ControllerService } from "../services/controllerService";
import { mockControllerService } from "../services/mockControllerProvider";
import { liveControllerService } from "../services/liveControllerService";
import { dataMode } from "../lib/supabaseClient";
import type { ControllerAction, ControllerStats, CorrectionReason, Rating } from "../types/controller";

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
  const [historyState, setHistoryState] = useState<HistoryState>({ status: "loading", actions: [] });
  const [meetingMessage, setMeetingMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [undoMessage, setUndoMessage] = useState("");
  const meetingRequest = useRef<{ requestId: string; quantity: 1 | 2 | 3 } | null>(null);
  const feedbackRequest = useRef<{ requestId: string; rating: Rating } | null>(null);
  const undoRequest = useRef<{ requestId: string; originalRequestId: string; reason: CorrectionReason } | null>(null);
  const meetingPending = useRef(false);
  const feedbackPending = useRef(false);
  const undoPending = useRef(false);
  const historyRead = useRef(0);

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
            action.reversedAt !== null)) {
          undoRequest.current = null;
          setUndoState("success");
          setUndoMessage("This action is now reversed. The displayed totals are being refreshed.");
          void loadStats();
        }
      }
    } catch {
      if (read === historyRead.current) setHistoryState((previous) => ({ ...previous, status: "error" }));
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

  async function undoAction(originalRequestId: string, reason: CorrectionReason): Promise<boolean> {
    const original = historyState.actions.find((action) => action.requestId === originalRequestId);
    if (undoPending.current || statsState.status !== "ready" || historyState.status !== "ready" ||
        !original || original.reversedAt !== null) {
      return false;
    }
    if (undoRequest.current && (undoRequest.current.originalRequestId !== originalRequestId ||
        undoRequest.current.reason !== reason)) return false;
    undoPending.current = true;
    undoRequest.current ??= { requestId: crypto.randomUUID(), originalRequestId, reason };
    setUndoState("pending");
    setUndoMessage("");
    try {
      const response = await service.undoAction(undoRequest.current);
      setStatsState({ status: "ready", stats: response.stats });
      if (original.kind === "meeting") {
        setMeetingState("success");
        setMeetingMessage(`Selected meeting action reversed. Total: ${response.stats.completedMeetings}.`);
      } else {
        setFeedbackState("success");
        setFeedbackMessage("Selected rating reversed. Feedback average updated.");
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
    historyState,
    meetingMessage,
    meetingActiveQuantity: meetingRequest.current?.quantity,
    meetingRetryQuantity: meetingState === "error" ? meetingRequest.current?.quantity : undefined,
    feedbackMessage,
    undoMessage,
    undoRetryOriginalRequestId: undoState === "error" ? undoRequest.current?.originalRequestId : undefined,
    undoRetryReason: undoState === "error" ? undoRequest.current?.reason : undefined,
    loadStats,
    loadActions,
    submitMeeting,
    submitFeedback,
    undoAction,
  };
}
