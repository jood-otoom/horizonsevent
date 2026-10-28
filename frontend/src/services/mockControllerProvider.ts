import { ControllerConflictError, type ControllerService } from "./controllerService";
import type {
  ControllerAction,
  ControllerStats,
  CheckinStatus,
  FeedbackRecord,
  FeedbackSubmissionRequest,
  MeetingRecord,
  MeetingSubmissionRequest,
  Rating,
  ControllerSettings,
  SettingsRequest,
} from "../types/controller";

interface MockOptions {
  delayMs?: number;
  initialMeetings?: MeetingRecord[];
  initialFeedback?: FeedbackRecord[];
  failNext?: { stats?: number; meeting?: number; feedback?: number; checkin?: number; undo?: number };
  initialCheckins?: number;
  registered?: number;
  recoveredApiCheckins?: number;
  initialMode?: "api" | "manual";
  role?: "staff" | "admin";
}

export function createMockControllerService(options: MockOptions = {}): ControllerService {
  const meetings = [...(options.initialMeetings ?? [])];
  const feedback = [...(options.initialFeedback ?? [])];
  const meetingRequests = new Map<string, { records: MeetingRecord[]; quantity: number }>();
  const feedbackRequests = new Map<string, FeedbackRecord>();
  const actions: ControllerAction[] = [];
  const auditEvents: ControllerAction[] = [];
  const reversals = new Map<string, { requestId: string; reason: string; createdAt: string }>();
  const checkinRequests = new Map<string, { id: string; createdAt: string }>();
  const checkinPayloads = new Map<string, string>();
  let registered = options.registered ?? 120;
  let checkedIn = options.initialCheckins ?? 35;
  let mode: CheckinStatus["mode"] = options.initialMode ?? "manual";
  let version = 0;
  let meetingTarget = 1200;
  let registeredOverride: number | null = null;
  let syncState: ControllerSettings["syncState"] = mode === "manual" ? "manual" : "stopped";
  const settingsRequests = new Map<string, SettingsRequest>();
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
      canReconcile: false, version, source: mode === "manual" ? "manual" : "api",
      manualFallback: mode === "manual", canSetExact: (options.role ?? "admin") === "admin" };
  }

  function settings(): ControllerSettings {
    return { role: options.role ?? "admin", mode, syncState, syncEnabled: syncState === "running",
      version, registered, checkedIn, source: mode === "manual" ? "manual" : "api", registeredOverride,
      meetingTarget, lastSuccessAt: apiAsOf, lastAttemptAt: null, nextSyncAt: null,
      apiRegistered: options.registered ?? 120, apiCheckedIn, error: null, httpStatus: null,
      canStart: mode === "api" && syncState !== "running" };
  }

  function assertAdmin() {
    if (options.role === "staff") throw new Error("Settings and exact-total corrections are available to event administrators only.");
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
          undoEligible: action.undoEligible !== false && (action.operation === undefined || action.operation === "submission") &&
            action.reversedAt === null && (action.kind !== "checkin" || mode === "manual" &&
              action.createdAt >= (sessionStart ?? "")) }));
    },
    async getCheckins() { await wait(); return checkins(); },
    async submitCheckin({ requestId, quantity = 1 }) {
      assertRequestId(requestId);
      await wait();
      maybeFail("checkin");
      let record = checkinRequests.get(requestId);
      if (record && checkinPayloads.get(requestId) !== JSON.stringify({ quantity })) throw new Error("Request conflict.");
      if (!record) {
        if (mode !== "manual") throw new Error("Activate Manual Mode in Settings before updating check-ins.");
        if (![1, 2, 5, 10].includes(quantity) || checkedIn + quantity > registered) throw new Error("Attendance at capacity.");
        record = { id: requestId, createdAt: new Date().toISOString() };
        checkinRequests.set(requestId, record);
        checkinPayloads.set(requestId, JSON.stringify({ quantity }));
        checkedIn += quantity;
        version++;
        actions.push({ requestId, kind: "checkin", quantity, rating: null,
          createdAt: record.createdAt, reversedAt: null });
        if (options.recoveredApiCheckins !== undefined) {
          apiCheckedIn = options.recoveredApiCheckins;
          apiAsOf = new Date(Date.now() + 1000).toISOString();
        }
      }
      return { record, checkins: checkins() };
    },
    async setCheckins({ requestId, checkedIn: value, expectedVersion }) {
      assertAdmin();
      assertRequestId(requestId);
      await wait();
      const previous = checkinRequests.get(requestId);
      if (previous) {
        if (checkinPayloads.get(requestId) !== JSON.stringify({ checkedIn: value, expectedVersion })) throw new Error("Request conflict.");
        return { record: previous, checkins: checkins() };
      }
      if (mode !== "manual" || expectedVersion !== version || !Number.isSafeInteger(value) || value < 0 || value > registered) {
        throw new ControllerConflictError("The event values changed or the total is invalid. Refresh before trying again.");
      }
      checkedIn = value;
      version++;
      sessionStart = new Date().toISOString();
      const record = { id: requestId, createdAt: sessionStart };
      checkinRequests.set(requestId, record);
      checkinPayloads.set(requestId, JSON.stringify({ checkedIn: value, expectedVersion }));
      auditEvents.push({ requestId, kind: "checkin", operation: "set_checkins", value, quantity: null, rating: null,
        label: `Set checked-in total to ${value}`, createdAt: record.createdAt, reversedAt: null, undoEligible: false });
      return { record, checkins: checkins() };
    },
    async getSettings() { await wait(); assertAdmin(); return settings(); },
    async updateSettings(request) {
      assertAdmin();
      assertRequestId(request.requestId);
      if (request.kind === "reset_event" && (request.scope !== "match_grow" || request.confirmation !== "RESET EVENT")) {
        throw new Error("MATCH/GROW reset scope and confirmation required.");
      }
      await wait();
      const prior = settingsRequests.get(request.requestId);
      if (prior && JSON.stringify(prior) !== JSON.stringify(request)) throw new Error("Request conflict.");
      if (!prior) {
        if (request.expectedVersion !== version) throw new ControllerConflictError("The event values changed. Refresh the latest values before trying again.");
        if (request.kind === "start_sync") {
          if (mode === "manual") throw new Error("Manual Mode cannot return to API mode.");
          syncState = "running";
        } else if (request.kind === "stop_sync") syncState = "stopped";
        else if (request.kind === "manual_mode") { mode = "manual"; syncState = "manual"; }
        else if (request.kind === "update_settings") {
          if (request.registeredOverride !== undefined) {
            if (!Number.isSafeInteger(request.registeredOverride) || request.registeredOverride < checkedIn) throw new Error("Registered participants cannot be below checked-in participants.");
            registered = request.registeredOverride;
            registeredOverride = registered;
          }
          if (request.meetingTarget !== undefined) {
            if (!Number.isSafeInteger(request.meetingTarget) || request.meetingTarget <= 0) throw new Error("Meeting target must be a positive integer.");
            meetingTarget = request.meetingTarget;
          }
        } else if (request.kind === "reset_event") {
          meetings.splice(0);
          feedback.splice(0);
          actions.filter(action => action.kind === "meeting" || action.kind === "feedback").forEach(action => { action.undoEligible = false; });
        }
        version++;
        settingsRequests.set(request.requestId, request);
        auditEvents.push({ requestId: request.requestId, kind: "settings",
          operation: request.kind === "manual_mode" ? "activate_manual" : request.kind,
          ...(request.kind === "reset_event" ? { label: "Reset MATCH & GROW totals" } : {}),
          quantity: null, rating: null, createdAt: new Date().toISOString(), reversedAt: null, undoEligible: false });
      }
      return { settings: settings(), checkins: checkins(), record: { id: request.requestId, createdAt: new Date().toISOString() } };
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
      if (action.undoEligible === false) throw new Error("This action cannot be undone.");
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
        if (action.operation === "set_checkins") throw new Error("This action cannot be undone.");
        checkedIn -= action.quantity ?? 1;
        version++;
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
