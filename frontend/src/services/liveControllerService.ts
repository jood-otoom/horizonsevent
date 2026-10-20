import { supabase } from "../lib/supabaseClient";
import type { ControllerService } from "./controllerService";
import { fetchLiveDashboard } from "./dashboardService";
import type {
  ControllerAction, ControllerStats, FeedbackSubmissionResponse, MeetingSubmissionResponse,
  UndoResponse,
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
    if (action.kind === "meeting" && (action.quantity === 1 || action.quantity === 2 || action.quantity === 3) &&
        action.rating === null) {
      return { requestId: action.requestId, kind: "meeting", quantity: action.quantity,
        rating: null, createdAt: action.createdAt, reversedAt: action.reversedAt as string | null };
    }
    if (action.kind === "feedback" && Number.isInteger(action.rating) &&
        Number(action.rating) >= 1 && Number(action.rating) <= 5 && action.quantity === null) {
      return { requestId: action.requestId, kind: "feedback", quantity: null,
        rating: action.rating as ControllerAction["rating"], createdAt: action.createdAt,
        reversedAt: action.reversedAt as string | null };
    }
    throw new Error("Invalid controller history.");
  });
}

export const liveControllerService: ControllerService = {
  async getStats() {
    const dashboard = await fetchLiveDashboard(client());
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
