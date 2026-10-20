const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Submission =
  | { kind: "meeting"; requestId: string; quantity: 1 | 2 | 3 }
  | { kind: "feedback"; requestId: string; rating: 1 | 2 | 3 | 4 | 5 }
  | { kind: "undo"; requestId: string; originalRequestId: string;
      reason: "duplicate" | "wrong_count" | "wrong_rating" | "other" };

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
  if (body.kind === "undo" && typeof body.originalRequestId === "string" &&
      uuid.test(body.originalRequestId) && body.originalRequestId !== body.requestId &&
      (body.reason === "duplicate" || body.reason === "wrong_count" ||
       body.reason === "wrong_rating" || body.reason === "other")) {
    return { kind: "undo", requestId: body.requestId,
      originalRequestId: body.originalRequestId, reason: body.reason };
  }
  throw new Error("invalid_submission");
}
