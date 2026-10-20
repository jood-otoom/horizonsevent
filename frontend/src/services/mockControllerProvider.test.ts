import { describe, expect, it } from "vitest";
import { createMockControllerService } from "./mockControllerProvider";

describe("mock controller provider", () => {
  it("starts empty and calculates averages from individual ratings", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    expect(await service.getStats()).toEqual({
      dataMode: "mock",
      completedMeetings: 0,
      feedbackCount: 0,
      averageRating: null,
    });

    await service.submitFeedback({ requestId: "first", rating: 1 });
    const result = await service.submitFeedback({ requestId: "second", rating: 5 });
    expect(result.stats.feedbackCount).toBe(2);
    expect(result.stats.averageRating).toBe(3);
    expect((await service.getStats()).averageRating).toBe(3);
  });

  it("creates one meeting record per distinct request and deduplicates repeated requests", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    const first = await service.submitMeeting({ requestId: "same" });
    const repeated = await service.submitMeeting({ requestId: "same" });
    const second = await service.submitMeeting({ requestId: "different" });

    expect(first.record.id).toBe(repeated.record.id);
    expect(repeated.stats.completedMeetings).toBe(1);
    expect(second.record.id).not.toBe(first.record.id);
    expect(second.stats.completedMeetings).toBe(2);
    expect(Number.isFinite(Date.parse(first.record.createdAt))).toBe(true);
  });

  it("records +3 as three meetings and keeps a retried request idempotent", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    const first = await service.submitMeeting({ requestId: "batch", quantity: 3 });
    const repeated = await service.submitMeeting({ requestId: "batch", quantity: 3 });
    expect(first.stats.completedMeetings).toBe(3);
    expect(repeated.record.id).toBe(first.record.id);
    expect(repeated.stats.completedMeetings).toBe(3);
    await expect(service.submitMeeting({ requestId: "batch", quantity: 2 })).rejects.toThrow();
  });

  it("deduplicates simultaneous taps with the same ID", async () => {
    const service = createMockControllerService({ delayMs: 1 });
    const results = await Promise.all([
      service.submitMeeting({ requestId: "double-tap" }),
      service.submitMeeting({ requestId: "double-tap" }),
    ]);
    expect(results[0].record.id).toBe(results[1].record.id);
    expect((await service.getStats()).completedMeetings).toBe(1);
  });

  it("deduplicates ratings and rejects invalid values or changed payloads", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    await expect(service.submitFeedback({ requestId: "bad", rating: 0 as 1 })).rejects.toThrow();
    await expect(service.submitFeedback({ requestId: "bad", rating: 6 as 5 })).rejects.toThrow();
    await expect(service.submitFeedback({ requestId: "bad", rating: 2.5 as 2 })).rejects.toThrow();
    const first = await service.submitFeedback({ requestId: "rating", rating: 4 });
    const repeated = await service.submitFeedback({ requestId: "rating", rating: 4 });
    expect(repeated.record.id).toBe(first.record.id);
    expect(repeated.stats.feedbackCount).toBe(1);
    await expect(service.submitFeedback({ requestId: "rating", rating: 5 })).rejects.toThrow();
    expect((await service.getStats()).averageRating).toBe(4);
  });

  it("does not change statistics on a failed submission and allows a safe retry", async () => {
    const service = createMockControllerService({
      delayMs: 0,
      failNext: { stats: 1, meeting: 1, feedback: 1 },
    });
    await expect(service.getStats()).rejects.toThrow("Simulated stats failure");
    await expect(service.submitMeeting({ requestId: "meeting-retry" })).rejects.toThrow();
    expect((await service.getStats()).completedMeetings).toBe(0);
    expect((await service.submitMeeting({ requestId: "meeting-retry" })).stats.completedMeetings).toBe(1);
    await expect(service.submitFeedback({ requestId: "feedback-retry", rating: 5 })).rejects.toThrow();
    expect((await service.getStats()).feedbackCount).toBe(0);
    expect((await service.submitFeedback({ requestId: "feedback-retry", rating: 5 })).stats.feedbackCount).toBe(1);
  });

  it("reverses a specific +3 action once while retaining its audit entry", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    await service.submitMeeting({ requestId: "batch", quantity: 3 });
    await service.submitMeeting({ requestId: "other", quantity: 1 });
    await expect(service.undoAction({ requestId: "bad-reason", originalRequestId: "batch",
      reason: "wrong_rating" })).rejects.toThrow("Invalid correction reason");
    const request = { requestId: "undo-batch", originalRequestId: "batch", reason: "wrong_count" as const };
    expect((await service.undoAction(request)).stats.completedMeetings).toBe(1);
    expect((await service.undoAction(request)).stats.completedMeetings).toBe(1);
    await expect(service.undoAction({ ...request, requestId: "new-undo" })).rejects.toThrow("Already reversed");
    const actions = await service.getRecentActions();
    expect(actions.find((action) => action.requestId === "batch")?.reversedAt).not.toBeNull();
    expect(actions.find((action) => action.requestId === "other")?.reversedAt).toBeNull();
  });

  it("reverses a rating and recalculates its average, with retry after failure", async () => {
    const service = createMockControllerService({ delayMs: 0, failNext: { undo: 1 } });
    await service.submitFeedback({ requestId: "low", rating: 1 });
    await service.submitFeedback({ requestId: "high", rating: 5 });
    const request = { requestId: "undo-low", originalRequestId: "low", reason: "wrong_rating" as const };
    await expect(service.undoAction(request)).rejects.toThrow("Simulated undo failure");
    expect((await service.getStats()).averageRating).toBe(3);
    const result = await service.undoAction(request);
    expect(result.stats.feedbackCount).toBe(1);
    expect(result.stats.averageRating).toBe(5);
    expect((await service.undoAction(request)).stats.feedbackCount).toBe(1);
  });
});
