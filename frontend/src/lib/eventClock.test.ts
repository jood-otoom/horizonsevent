import { describe, expect, it } from "vitest";
import { EVENT_TIME_ZONE, formatEventDateTime } from "./eventClock";

describe("formatEventDateTime", () => {
  it("formats the instant in the event time zone", () => {
    const result = formatEventDateTime(new Date("2026-04-14T07:24:00Z"));

    expect(EVENT_TIME_ZONE).toBe("Asia/Amman");
    expect(result).toEqual({
      date: "Tue, Apr 14, 2026",
      time: "10:24 AM",
    });
  });
});
