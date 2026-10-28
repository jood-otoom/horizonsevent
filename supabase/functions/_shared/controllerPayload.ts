const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_647;
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export type Submission =
  | { kind: "meeting"; requestId: string; quantity: 1 | 2 | 3 }
  | { kind: "feedback"; requestId: string; rating: 1 | 2 | 3 | 4 | 5 }
  | { kind: "checkin"; requestId: string; quantity: 1 | 2 | 5 | 10 }
  | { kind: "set_checkins"; requestId: string; checkedIn: number; expectedVersion: number }
  | { kind: "start_sync" | "stop_sync" | "manual_mode"; requestId: string; expectedVersion: number }
  | { kind: "update_settings"; requestId: string; expectedVersion: number; registeredOverride?: number; meetingTarget?: number }
  | { kind: "reset_event"; requestId: string; expectedVersion: number; confirmation: "RESET EVENT"; scope: "match_grow" }
  | { kind: "undo"; requestId: string; originalRequestId: string;
      reason: "duplicate" | "wrong_count" | "wrong_rating" | "other" };

export function isAdminSubmission(submission: Submission): boolean {
  return ["set_checkins", "start_sync", "stop_sync", "manual_mode", "update_settings", "reset_event"].includes(submission.kind);
}

export function parseSubmission(value: unknown): Submission {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_submission");
  const body = value as Record<string, unknown>;
  if (body.eventId !== undefined && body.eventId !== 17135) throw new Error("invalid_event");
  if (typeof body.requestId !== "string" || !uuid.test(body.requestId)) throw new Error("invalid_submission");
  if (body.kind === "meeting" && (body.quantity === 1 || body.quantity === 2 || body.quantity === 3)) {
    return { kind: "meeting", requestId: body.requestId, quantity: body.quantity };
  }
  if (body.kind === "feedback" && Number.isInteger(body.rating) && Number(body.rating) >= 1 && Number(body.rating) <= 5) {
    return { kind: "feedback", requestId: body.requestId, rating: body.rating as 1 | 2 | 3 | 4 | 5 };
  }
  if (body.kind === "checkin" && (body.quantity === undefined || body.quantity === 1 || body.quantity === 2 || body.quantity === 5 || body.quantity === 10)) {
    return { kind: "checkin", requestId: body.requestId, quantity: (body.quantity ?? 1) as 1 | 2 | 5 | 10 };
  }
  if (body.kind === "set_checkins" && integer(body.checkedIn) && version(body.expectedVersion)) {
    return { kind: "set_checkins", requestId: body.requestId, checkedIn: body.checkedIn, expectedVersion: body.expectedVersion };
  }
  if ((body.kind === "start_sync" || body.kind === "stop_sync" || body.kind === "manual_mode") && version(body.expectedVersion)) {
    return { kind: body.kind, requestId: body.requestId, expectedVersion: body.expectedVersion };
  }
  if (body.kind === "update_settings" && version(body.expectedVersion) &&
      (body.registeredOverride !== undefined || body.meetingTarget !== undefined) &&
      (body.registeredOverride === undefined || integer(body.registeredOverride)) &&
      (body.meetingTarget === undefined || (integer(body.meetingTarget) && body.meetingTarget > 0))) {
    return { kind: "update_settings", requestId: body.requestId, expectedVersion: body.expectedVersion,
      ...(body.registeredOverride !== undefined ? { registeredOverride: body.registeredOverride as number } : {}),
      ...(body.meetingTarget !== undefined ? { meetingTarget: body.meetingTarget as number } : {}) };
  }
  if (body.kind === "reset_event" && version(body.expectedVersion) && body.confirmation === "RESET EVENT" && body.scope === "match_grow") {
    return { kind: "reset_event", requestId: body.requestId, expectedVersion: body.expectedVersion, confirmation: "RESET EVENT", scope: "match_grow" };
  }
  if (body.kind === "undo" && typeof body.originalRequestId === "string" &&
      uuid.test(body.originalRequestId) && body.originalRequestId !== body.requestId &&
      (body.reason === "duplicate" || body.reason === "wrong_count" ||
       body.reason === "wrong_rating" || body.reason === "other")) {
    return { kind: "undo", requestId: body.requestId,
      originalRequestId: body.originalRequestId, reason: body.reason };
  }
  throw new Error("invalid_submission");
}
