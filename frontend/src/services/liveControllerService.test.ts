import { describe, expect, it } from "vitest";
import { parseActions } from "./liveControllerService";

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
});
