import { describe, expect, it } from "vitest";
import { parseActions, parseCheckins, parseSettings } from "./liveControllerService";

const action = {
  requestId: "11111111-1111-4111-8111-111111111111",
  kind: "meeting",
  quantity: 2,
  rating: null,
  createdAt: "2026-10-15T20:00:00Z",
  reversedAt: null,
};

describe("live controller history boundary", () => {
  it("accepts a valid action and reversal timestamp", () => {
    expect(parseActions({ actions: [action, {
      ...action, kind: "feedback", quantity: null, rating: 5,
      reversedAt: "2026-10-15T20:01:00Z",
    }] })).toHaveLength(2);
  });

  it("rejects contradictory or malformed history without displaying it", () => {
    expect(() => parseActions({ actions: [{ ...action, rating: 5 }] })).toThrow();
    expect(() => parseActions({ actions: [{ ...action, reversedAt: "unknown" }] })).toThrow();
    expect(() => parseActions({ actions: [{ ...action, requestId: "not-a-uuid" }] })).toThrow();
    expect(() => parseActions({ actions: Array(13).fill(action) })).toThrow();
  });

  it("accepts manual check-ins and validates the reconciled aggregate boundary", () => {
    expect(parseActions({ actions: [{ ...action, kind: "checkin", quantity: 1,
      undoEligible: false }] })[0].undoEligible).toBe(false);
    expect(parseCheckins({ mode: "manual", registered: 202, checkedIn: 1,
      apiCheckedIn: 2, apiAsOf: "2026-10-23T00:00:00Z", canReconcile: true }).checkedIn).toBe(1);
    expect(() => parseCheckins({ mode: "manual", registered: 1, checkedIn: 2,
      apiCheckedIn: 2, apiAsOf: "2026-10-23T00:00:00Z", canReconcile: true })).toThrow();
  });

  it("accepts administrator audit operations without granting Undo", () => {
    expect(parseActions({ actions: [{ ...action, kind: "settings", operation: "reset_event",
      quantity: null, undoEligible: false }, { ...action, kind: "checkin", operation: "set_checkins",
      quantity: null, value: 20, undoEligible: false }, { ...action, kind: "checkin", quantity: 10 }] }))
      .toMatchObject([{ kind: "settings", undoEligible: false }, { value: 20, undoEligible: false }, { quantity: 10 }]);
    expect(() => parseActions({ actions: [{ ...action, kind: "settings", operation: "reset_event",
      quantity: null, undoEligible: true }] })).toThrow();
  });

  it("validates settings counts, versions, states, and timestamps at the boundary", () => {
    const settings = { role: "admin", mode: "manual", syncState: "manual", syncEnabled: false,
      version: 3, registered: 100, checkedIn: 10, source: "manual", registeredOverride: 100,
      meetingTarget: 1200, lastSuccessAt: "2026-10-28T08:00:00Z", lastAttemptAt: null,
      nextSyncAt: null, apiRegistered: 90, apiCheckedIn: 5, error: null, httpStatus: null, canStart: false };
    expect(parseSettings(settings).version).toBe(3);
    expect(() => parseSettings({ ...settings, checkedIn: 101 })).toThrow();
    expect(() => parseSettings({ ...settings, version: -1 })).toThrow();
    expect(() => parseSettings({ ...settings, registered: 1.5 })).toThrow();
    expect(() => parseSettings({ ...settings, lastAttemptAt: "invalid" })).toThrow();
    expect(() => parseSettings({ ...settings, syncState: "retrying" })).toThrow();
  });
});
