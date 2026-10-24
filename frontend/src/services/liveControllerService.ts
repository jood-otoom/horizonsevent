import { supabase } from "../lib/supabaseClient";
import type { ControllerService } from "./controllerService";
import { fetchControllerDashboard } from "./dashboardService";
import type {
  ControllerAction, ControllerStats, FeedbackSubmissionResponse, MeetingSubmissionResponse,
  UndoResponse, CheckinStatus, CheckinSubmissionResponse, ReconcileCheckinsRequest,
} from "../types/controller";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function client() {
  if (!supabase) throw new Error("Live Supabase configuration is missing.");
  return supabase;
}

function parseStats(value: unknown): ControllerStats {
  if (!value || typeof value !== "object") throw new Error("Invalid controller response.");
  const data = value as Record<string, unknown>;
  if (data.dataMode !== "live" || !Number.isSafeInteger(data.completedMeetings) ||
      Number(data.completedMeetings) < 0 || !Number.isSafeInteger(data.feedbackCount) ||
      Number(data.feedbackCount) < 0 ||
      (Number(data.feedbackCount) === 0 ? data.averageRating !== null :
        typeof data.averageRating !== "number" || !Number.isFinite(data.averageRating) ||
        data.averageRating < 1 || data.averageRating > 5)) {
    throw new Error("Invalid controller response.");
  }
  return {
    dataMode: "live", completedMeetings: Number(data.completedMeetings),
    feedbackCount: Number(data.feedbackCount),
    averageRating: data.averageRating === null ? null : Number(data.averageRating),
  };
}

function parseRecord(value: unknown): { id: string; createdAt: string; rating?: number } {
  if (!value || typeof value !== "object") throw new Error("Invalid controller response.");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id ||
      typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt))) {
    throw new Error("Invalid controller response.");
  }
  return { id: record.id, createdAt: record.createdAt, rating: typeof record.rating === "number" ? record.rating : undefined };
}

export function parseActions(value: unknown): ControllerAction[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { actions?: unknown }).actions)) {
    throw new Error("Invalid controller history.");
  }
  const actions = (value as { actions: unknown[] }).actions;
  if (actions.length > 12) throw new Error("Invalid controller history.");
  return actions.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid controller history.");
    const action = value as Record<string, unknown>;
    if (typeof action.requestId !== "string" || !uuid.test(action.requestId) ||
        typeof action.createdAt !== "string" || !Number.isFinite(Date.parse(action.createdAt)) ||
        (action.reversedAt !== null && (typeof action.reversedAt !== "string" ||
          !Number.isFinite(Date.parse(action.reversedAt))))) {
      throw new Error("Invalid controller history.");
    }
    const operation = action.operation === undefined ? "submission" : action.operation;
    if (operation !== "submission" && operation !== "undo" && operation !== "reconcile") {
      throw new Error("Invalid controller history.");
    }
    const undoEligible = action.undoEligible === undefined ? action.reversedAt === null : action.undoEligible;
    if (typeof undoEligible !== "boolean") throw new Error("Invalid controller history.");
    if (operation === "reconcile" && action.kind === "checkin" && action.quantity === null &&
        action.rating === null && Number.isSafeInteger(action.value) && Number(action.value) >= 0) {
      return { requestId: action.requestId, kind: "checkin", operation, quantity: null,
        rating: null, value: Number(action.value), createdAt: action.createdAt,
        reversedAt: null, undoEligible: false };
    }
    const validUndoShape = action.kind === "meeting"
      ? (action.quantity === 1 || action.quantity === 2 || action.quantity === 3) && action.rating === null
      : action.kind === "feedback"
        ? action.quantity === null && Number.isInteger(action.rating) && Number(action.rating) >= 1 && Number(action.rating) <= 5
        : action.kind === "checkin" && action.quantity === 1 && action.rating === null;
    if (operation === "undo" && validUndoShape &&
        typeof action.originalRequestId === "string" && uuid.test(action.originalRequestId) &&
        action.reversedAt === null) {
      return { requestId: action.requestId, kind: action.kind as ControllerAction["kind"], operation, originalRequestId: action.originalRequestId,
        quantity: action.quantity as ControllerAction["quantity"], rating: action.rating as ControllerAction["rating"],
        createdAt: action.createdAt, reversedAt: null, undoEligible: false };
    }
    if (operation !== "submission") throw new Error("Invalid controller history.");
    if (action.kind === "meeting" && (action.quantity === 1 || action.quantity === 2 || action.quantity === 3) &&
        action.rating === null) {
      return { requestId: action.requestId, kind: "meeting", operation, quantity: action.quantity,
        rating: null, createdAt: action.createdAt, reversedAt: action.reversedAt as string | null, undoEligible };
    }
    if (action.kind === "feedback" && Number.isInteger(action.rating) &&
        Number(action.rating) >= 1 && Number(action.rating) <= 5 && action.quantity === null) {
      return { requestId: action.requestId, kind: "feedback", operation, quantity: null,
        rating: action.rating as ControllerAction["rating"], createdAt: action.createdAt,
        reversedAt: action.reversedAt as string | null, undoEligible };
    }
    if (action.kind === "checkin" && action.quantity === 1 && action.rating === null) {
      return { requestId: action.requestId, kind: "checkin", operation, quantity: 1, rating: null,
        createdAt: action.createdAt, reversedAt: action.reversedAt as string | null, undoEligible };
    }
    throw new Error("Invalid controller history.");
  });
}

export function parseCheckins(value: unknown): CheckinStatus {
  if (!value || typeof value !== "object") throw new Error("Invalid check-in status.");
  const status = value as Record<string, unknown>;
  const count = (item: unknown) => item === null || (Number.isSafeInteger(item) && Number(item) >= 0);
  if ((status.mode !== "api" && status.mode !== "manual") ||
      !count(status.registered) || !count(status.checkedIn) || !count(status.apiCheckedIn) ||
      (status.apiAsOf !== null && (typeof status.apiAsOf !== "string" ||
        !Number.isFinite(Date.parse(status.apiAsOf)))) ||
      typeof status.canReconcile !== "boolean" ||
      (status.registered !== null && status.checkedIn !== null &&
        Number(status.checkedIn) > Number(status.registered))) {
    throw new Error("Invalid check-in status.");
  }
  return status as unknown as CheckinStatus;
}

function parseCheckinSubmission(value: unknown): CheckinSubmissionResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid check-in response.");
  const response = value as Record<string, unknown>;
  return { record: parseRecord(response.record), checkins: parseCheckins(response.checkins) };
}

export const liveControllerService: ControllerService = {
  async getStats() {
    const dashboard = await fetchControllerDashboard(client());
    return parseStats({
      dataMode: "live", completedMeetings: dashboard.match.completedMeetings,
      feedbackCount: dashboard.grow.feedbackCount, averageRating: dashboard.grow.averageRating,
    });
  },
  async getRecentActions() {
    const { data, error } = await client().functions.invoke("controller-submit", { method: "GET" });
    if (error) throw new Error("Recent actions are unavailable.");
    return parseActions(data);
  },
  async getCheckins() {
    const { data, error } = await client().functions.invoke("controller-submit?view=checkins", { method: "GET" });
    if (error) throw new Error("Check-in status is unavailable.");
    return parseCheckins((data as Record<string, unknown>)?.checkins);
  },
  async submitMeeting({ requestId, quantity = 1 }): Promise<MeetingSubmissionResponse> {
    const { data, error } = await client().functions.invoke("controller-submit", {
      method: "POST", body: { eventId: 17135, kind: "meeting", requestId, quantity },
    });
    if (error) throw new Error("Meeting submission was not confirmed.");
    const response = data as Record<string, unknown>;
    const record = parseRecord(response?.record);
    return { record, stats: parseStats(response?.stats) };
  },
  async submitFeedback({ requestId, rating }): Promise<FeedbackSubmissionResponse> {
    const { data, error } = await client().functions.invoke("controller-submit", {
      method: "POST", body: { eventId: 17135, kind: "feedback", requestId, rating },
    });
    if (error) throw new Error("Feedback submission was not confirmed.");
    const response = data as Record<string, unknown>;
    const record = parseRecord(response?.record);
    if (record.rating !== rating) throw new Error("Invalid controller response.");
    return { record: { ...record, rating }, stats: parseStats(response?.stats) };
  },
  async submitCheckin({ requestId }): Promise<CheckinSubmissionResponse> {
    const { data, error } = await client().functions.invoke("controller-submit", {
      method: "POST", body: { eventId: 17135, kind: "checkin", requestId },
    });
    if (error) throw new Error("Check-in was not confirmed.");
    return parseCheckinSubmission(data);
  },
  async reconcileCheckins(request: ReconcileCheckinsRequest): Promise<CheckinSubmissionResponse> {
    const { data, error } = await client().functions.invoke("controller-submit", {
      method: "POST", body: { eventId: 17135, kind: "reconcile_checkins", ...request },
    });
    if (error) throw new Error("Reconciliation was not confirmed.");
    return parseCheckinSubmission(data);
  },
  async undoAction({ requestId, originalRequestId, reason }): Promise<UndoResponse> {
    const { data, error } = await client().functions.invoke("controller-submit", {
      method: "POST", body: { eventId: 17135, kind: "undo", requestId, originalRequestId, reason },
    });
    if (error) throw new Error("Correction was not confirmed.");
    const response = data as Record<string, unknown>;
    const reversal = response?.reversal as Record<string, unknown> | undefined;
    const record = parseRecord(reversal);
    if (reversal?.originalRequestId !== originalRequestId) throw new Error("Invalid correction response.");
    return { reversal: { ...record, originalRequestId }, stats: parseStats(response?.stats) };
  },
};
