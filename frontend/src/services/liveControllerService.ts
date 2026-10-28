import { supabase } from "../lib/supabaseClient";
import type { ControllerService } from "./controllerService";
import { ControllerConflictError } from "./controllerService";
import { fetchLiveDashboard } from "./dashboardService";
import type {
  ControllerAction, ControllerStats, FeedbackSubmissionResponse, MeetingSubmissionResponse,
  UndoResponse, CheckinStatus, CheckinSubmissionResponse,
  ControllerSettings,
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
    if (action.kind === "settings" && ["update_settings", "reset_event", "activate_manual", "start_sync", "stop_sync"].includes(String(operation)) &&
        action.quantity === null && action.rating === null && action.reversedAt === null && action.undoEligible === false &&
        (action.label === undefined || typeof action.label === "string" && action.label.length <= 160)) {
      return { requestId: action.requestId, kind: "settings", operation: operation as ControllerAction["operation"],
        quantity: null, rating: null, createdAt: action.createdAt, reversedAt: null, undoEligible: false,
        label: typeof action.label === "string" ? action.label : undefined };
    }
    if (action.kind === "checkin" && operation === "set_checkins" && action.quantity === null && action.rating === null &&
        Number.isSafeInteger(action.value) && Number(action.value) >= 0 && action.undoEligible === false && action.reversedAt === null) {
      return { requestId: action.requestId, kind: "checkin", operation, quantity: null, rating: null,
        value: Number(action.value), createdAt: action.createdAt, reversedAt: null, undoEligible: false };
    }
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
        : action.kind === "checkin" && [1, 2, 5, 10].includes(Number(action.quantity)) && action.rating === null;
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
    if (action.kind === "checkin" && [1, 2, 5, 10].includes(Number(action.quantity)) && action.rating === null) {
      return { requestId: action.requestId, kind: "checkin", operation, quantity: action.quantity as ControllerAction["quantity"], rating: null,
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
      (status.version !== undefined && (!Number.isSafeInteger(status.version) || Number(status.version) < 0)) ||
      (status.source !== undefined && typeof status.source !== "string") ||
      (status.manualFallback !== undefined && typeof status.manualFallback !== "boolean") ||
      (status.canSetExact !== undefined && typeof status.canSetExact !== "boolean") ||
      (status.registered !== null && status.checkedIn !== null &&
        Number(status.checkedIn) > Number(status.registered))) {
    throw new Error("Invalid check-in status.");
  }
  return status as unknown as CheckinStatus;
}

export function parseSettings(value: unknown): ControllerSettings {
  if (!value || typeof value !== "object") throw new Error("Invalid settings response.");
  const settings = value as Record<string, unknown>;
  const count = (item: unknown) => item === null || Number.isSafeInteger(item) && Number(item) >= 0;
  const instant = (item: unknown) => item === null || typeof item === "string" && Number.isFinite(Date.parse(item));
  if ((settings.role !== "admin" && settings.role !== "staff") ||
      (settings.mode !== "api" && settings.mode !== "manual") ||
      !["stopped", "starting", "running", "syncing", "failed", "manual"].includes(String(settings.syncState)) ||
      typeof settings.syncEnabled !== "boolean" || typeof settings.canStart !== "boolean" ||
      !Number.isSafeInteger(settings.version) || Number(settings.version) < 0 ||
      typeof settings.source !== "string" ||
      ![settings.registered, settings.checkedIn, settings.registeredOverride, settings.meetingTarget,
        settings.apiRegistered, settings.apiCheckedIn].every(count) ||
      ![settings.lastSuccessAt, settings.lastAttemptAt, settings.nextSyncAt].every(instant) ||
      (settings.error !== null && typeof settings.error !== "string") ||
      (settings.httpStatus !== null && (!Number.isInteger(settings.httpStatus) || Number(settings.httpStatus) < 100 || Number(settings.httpStatus) > 599)) ||
      (settings.registered !== null && settings.checkedIn !== null && Number(settings.checkedIn) > Number(settings.registered))) {
    throw new Error("Invalid settings response.");
  }
  return settings as unknown as ControllerSettings;
}

async function invokeController(body?: unknown, admin = true) {
  const { data, error } = await client().functions.invoke(body ? "controller-submit" : "controller-submit?view=settings", {
    method: body ? "POST" : "GET", ...(body ? { body } : {}),
  });
  if (error) {
    const status = "context" in error && error.context instanceof Response ? error.context.status : null;
    if (status === 403) throw new ControllerConflictError(admin
      ? "Settings and exact-total corrections are available to event administrators only."
      : "This account is not authorized for this operation.");
    if (status === 409) throw new ControllerConflictError("The event values changed. Refresh the latest values before trying again.");
    if (status === 400 || status === 422) throw new ControllerConflictError("The operation was rejected. Refresh event values and check your entries before trying again.");
    throw new Error("The request was not confirmed. Retry safely with the same submission ID.");
  }
  return data as Record<string, unknown>;
}

function parseCheckinSubmission(value: unknown): CheckinSubmissionResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid check-in response.");
  const response = value as Record<string, unknown>;
  return { record: parseRecord(response.record), checkins: parseCheckins(response.checkins) };
}

export const liveControllerService: ControllerService = {
  async getStats() {
    const dashboard = await fetchLiveDashboard();
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
  async submitCheckin({ requestId, quantity = 1 }): Promise<CheckinSubmissionResponse> {
    const data = await invokeController({ eventId: 17135, kind: "checkin", requestId, quantity }, false);
    return parseCheckinSubmission(data);
  },
  async setCheckins(request) {
    const data = await invokeController({ eventId: 17135, kind: "set_checkins", ...request });
    return parseCheckinSubmission(data);
  },
  async getSettings() {
    const data = await invokeController();
    return parseSettings(data.settings);
  },
  async updateSettings(request) {
    const data = await invokeController({ eventId: 17135, ...request });
    return { settings: parseSettings(data.settings), checkins: parseCheckins(data.checkins), record: parseRecord(data.record) };
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
