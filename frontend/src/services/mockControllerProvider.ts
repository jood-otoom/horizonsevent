import type { ControllerService } from "./controllerService";
import type {
  ControllerAction,
  ControllerStats,
  CheckinStatus,
  FeedbackRecord,
  FeedbackSubmissionRequest,
  MeetingRecord,
  MeetingSubmissionRequest,
  Rating,
} from "../types/controller";

interface MockOptions {
  delayMs?: number;
  initialMeetings?: MeetingRecord[];
  initialFeedback?: FeedbackRecord[];
  failNext?: { stats?: number; meeting?: number; feedback?: number; checkin?: number; undo?: number };
  initialCheckins?: number;
  registered?: number;
  recoveredApiCheckins?: number;
}

export function createMockControllerService(options: MockOptions = {}): ControllerService {
  const meetings = [...(options.initialMeetings ?? [])];
  const feedback = [...(options.initialFeedback ?? [])];
  const meetingRequests = new Map<string, { records: MeetingRecord[]; quantity: number }>();
  const feedbackRequests = new Map<string, FeedbackRecord>();
  const actions: ControllerAction[] = [];
  const auditEvents: ControllerAction[] = [];
  const reversals = new Map<string, { requestId: string; reason: string; createdAt: string }>();
  const reconciliations = new Map<string, { record: { id: string; createdAt: string }; expectedManual: number; expectedApi: number; expectedApiAt: string }>();
  const checkinRequests = new Map<string, { id: string; createdAt: string }>();
  const registered = options.registered ?? 120;
  let checkedIn = options.initialCheckins ?? 35;
  let mode: CheckinStatus["mode"] = "api";
  let sessionStart: string | null = null;
  let apiCheckedIn = checkedIn;
  let apiAsOf = new Date().toISOString();
  const delayMs = options.delayMs ?? 350;
  const failures = { ...options.failNext };

  async function wait() {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  function getCurrentStats(): ControllerStats {
    const ratingSum = feedback.reduce((sum, record) => sum + record.rating, 0);
    return {
      dataMode: "mock",
      completedMeetings: meetings.length,
      feedbackCount: feedback.length,
      averageRating: feedback.length ? ratingSum / feedback.length : null,
    };
  }

  function assertRequestId(requestId: string) {
    if (!requestId || !requestId.trim()) throw new Error("A submission ID is required.");
  }

  function assertRating(rating: Rating) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Select a rating from 1 to 5.");
    }
  }

  function maybeFail(operation: "stats" | "meeting" | "feedback" | "checkin" | "undo") {
    if ((failures[operation] ?? 0) > 0) {
      failures[operation] = (failures[operation] ?? 0) - 1;
      throw new Error(`Simulated ${operation} failure.`);
    }
  }

  function checkins(): CheckinStatus {
    return { mode, registered, checkedIn, apiCheckedIn, apiAsOf,
      canReconcile: mode === "manual" && options.recoveredApiCheckins !== undefined };
  }

  return {
    async getStats() {
      await wait();
      maybeFail("stats");
      return getCurrentStats();
    },
    async getRecentActions() {
      await wait();
      return [...actions, ...auditEvents]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.requestId.localeCompare(a.requestId))
        .slice(0, 5).map((action) => ({ ...action,
          undoEligible: action.operation !== "undo" && action.operation !== "reconcile" &&
            action.reversedAt === null && (action.kind !== "checkin" || mode === "manual" &&
              action.createdAt >= (sessionStart ?? "")) }));
    },
    async getCheckins() { await wait(); return checkins(); },
    async submitCheckin({ requestId }) {
      assertRequestId(requestId);
      await wait();
      maybeFail("checkin");
      let record = checkinRequests.get(requestId);
      if (!record) {
        if (checkedIn >= registered) throw new Error("Attendance at capacity.");
        record = { id: requestId, createdAt: new Date().toISOString() };
        if (mode === "api") { mode = "manual"; sessionStart = record.createdAt; }
        checkinRequests.set(requestId, record);
        checkedIn++;
        actions.push({ requestId, kind: "checkin", quantity: 1, rating: null,
          createdAt: record.createdAt, reversedAt: null });
        if (options.recoveredApiCheckins !== undefined) {
          apiCheckedIn = options.recoveredApiCheckins;
          apiAsOf = new Date(Date.now() + 1000).toISOString();
        }
      }
      return { record, checkins: checkins() };
    },
    async reconcileCheckins({ requestId, expectedManual, expectedApi, expectedApiAt }) {
      assertRequestId(requestId);
      await wait();
      const prior = reconciliations.get(requestId);
      if (prior) {
        if (prior.expectedManual !== expectedManual || prior.expectedApi !== expectedApi ||
            prior.expectedApiAt !== expectedApiAt) throw new Error("Request conflict.");
        return { record: prior.record, checkins: checkins() };
      }
      if (mode !== "manual" || options.recoveredApiCheckins === undefined ||
          expectedManual !== checkedIn || expectedApi !== apiCheckedIn || expectedApiAt !== apiAsOf) {
        throw new Error("Reconciliation conflict.");
      }
      checkedIn = apiCheckedIn;
      mode = "api";
      sessionStart = null;
      const record = { id: requestId, createdAt: new Date().toISOString() };
      reconciliations.set(requestId, { record, expectedManual, expectedApi, expectedApiAt });
      auditEvents.push({ requestId, kind: "checkin", operation: "reconcile", quantity: null,
        rating: null, value: apiCheckedIn, createdAt: record.createdAt, reversedAt: null,
        undoEligible: false });
      return { record, checkins: checkins() };
    },
    async submitMeeting({ requestId, quantity = 1 }: MeetingSubmissionRequest) {
      assertRequestId(requestId);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3) throw new Error("Select 1, 2, or 3 meetings.");
      await wait();
      maybeFail("meeting");
      let previous = meetingRequests.get(requestId);
      if (previous && previous.quantity !== quantity) throw new Error("A submission ID cannot change its quantity.");
      if (!previous) {
        const createdAt = new Date().toISOString();
        const records = Array.from({ length: quantity }, () => ({ id: crypto.randomUUID(), createdAt }));
        meetings.push(...records);
        previous = { records, quantity };
        meetingRequests.set(requestId, previous);
        actions.push({ requestId, kind: "meeting", quantity: quantity as 1 | 2 | 3,
          rating: null, createdAt, reversedAt: null });
      }
      return { record: previous.records[0], stats: getCurrentStats() };
    },
    async submitFeedback({ requestId, rating }: FeedbackSubmissionRequest) {
      assertRequestId(requestId);
      assertRating(rating);
      await wait();
      maybeFail("feedback");
      let record = feedbackRequests.get(requestId);
      if (record && record.rating !== rating) {
        throw new Error("A submission ID cannot be reused for a different rating.");
      }
      if (!record) {
        record = { id: crypto.randomUUID(), rating, createdAt: new Date().toISOString() };
        feedback.push(record);
        feedbackRequests.set(requestId, record);
        actions.push({ requestId, kind: "feedback", quantity: null,
          rating, createdAt: record.createdAt, reversedAt: null });
      }
      return { record, stats: getCurrentStats() };
    },
    async undoAction({ requestId, originalRequestId, reason }) {
      assertRequestId(requestId);
      assertRequestId(originalRequestId);
      if (requestId === originalRequestId ||
          !["duplicate", "wrong_count", "wrong_rating", "other"].includes(reason)) {
        throw new Error("Invalid correction.");
      }
      await wait();
      maybeFail("undo");
      const action = actions.find((item) => item.requestId === originalRequestId);
      if (!action) throw new Error("Action not found.");
      if ((action.kind === "meeting" && reason === "wrong_rating") ||
          (action.kind === "feedback" && reason === "wrong_count") ||
          (action.kind === "checkin" && reason === "wrong_rating")) throw new Error("Invalid correction reason.");
      const previous = reversals.get(originalRequestId);
      if (previous) {
        if (previous.requestId !== requestId || previous.reason !== reason) throw new Error("Already reversed.");
        return { reversal: { id: requestId, originalRequestId, createdAt: previous.createdAt },
          stats: getCurrentStats() };
      }
      if ([...reversals.values()].some((item) => item.requestId === requestId)) throw new Error("Request conflict.");
      if (action.kind === "meeting") {
        const original = meetingRequests.get(originalRequestId);
        if (!original || original.records.length !== action.quantity) throw new Error("Record inconsistent.");
        const indexes = original.records.map((record) => meetings.findIndex((item) => item.id === record.id));
        if (indexes.some((index) => index < 0)) throw new Error("Record inconsistent.");
        for (const index of indexes.sort((a, b) => b - a)) meetings.splice(index, 1);
      } else if (action.kind === "feedback") {
        const original = feedbackRequests.get(originalRequestId);
        if (!original) throw new Error("Record inconsistent.");
        const index = feedback.findIndex((item) => item.id === original.id);
        if (index < 0) throw new Error("Record inconsistent.");
        feedback.splice(index, 1);
      } else {
        if (mode !== "manual" || action.createdAt < (sessionStart ?? "")) throw new Error("Reconciliation conflict.");
        checkedIn--;
      }
      const createdAt = new Date().toISOString();
      action.reversedAt = createdAt;
      reversals.set(originalRequestId, { requestId, reason, createdAt });
      auditEvents.push({ requestId, kind: action.kind, operation: "undo",
        originalRequestId, quantity: action.quantity, rating: action.rating,
        createdAt, reversedAt: null, undoEligible: false });
      return { reversal: { id: requestId, originalRequestId, createdAt }, stats: getCurrentStats() };
    },
  };
}

// In-memory session state only. Refreshing the page starts a new demo session.
export const mockControllerService = createMockControllerService();
