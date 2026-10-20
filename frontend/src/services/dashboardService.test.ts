import { describe, expect, it } from "vitest";
import { getMockMeetMetrics, parseLiveDashboardResponse, parseLiveMeetResponse } from "./dashboardService";

const live = {
  registered: 10, checkedIn: 7, checkInRate: 70,
  lastSuccessfulSync: "2026-10-10T10:00:00Z", verification: "approved", status: "live",
};

describe("dashboard data adapter", () => {
  it("labels local fixture data as synthetic", () => {
    expect(getMockMeetMetrics(new Date("2026-10-10T10:00:00Z"))).toMatchObject({
      dataMode: "mock", status: "mock", registered: 120, checkedIn: 35,
    });
  });

  it("validates a complete aggregate-only Supabase response", () => {
    expect(parseLiveDashboardResponse({
      eventId: 17135, meet: live,
      match: { completedMeetings: 3, targetMeetings: null },
      grow: { feedbackCount: 2, averageRating: 4.5 },
    })).toMatchObject({
      dataMode: "live", meet: { status: "ready", data: { registered: 10, status: "live" } },
      match: { completedMeetings: 3, targetMeetings: null },
      grow: { feedbackCount: 2, averageRating: 4.5 },
    });
  });

  it("accepts a portal-verified static snapshot without claiming a live sync", () => {
    expect(parseLiveMeetResponse({
      registered: 202, checkedIn: 0, checkInRate: 0,
      publishedAt: "2026-10-16T00:00:00Z", verification: "approved", status: "snapshot",
    })).toMatchObject({ registered: 202, checkedIn: 0, status: "snapshot" });
    expect(() => parseLiveMeetResponse({
      registered: 202, checkedIn: 0, checkInRate: 0,
      publishedAt: "2026-10-16T00:00:00Z", verification: "pending", status: "snapshot",
    })).toThrow();
  });

  it("rejects fabricated percentages, unknown events, and invalid aggregates", () => {
    expect(() => parseLiveMeetResponse({ ...live, checkInRate: 60 })).toThrow();
    expect(() => parseLiveMeetResponse({ ...live, verification: "pending" })).toThrow();
    expect(() => parseLiveDashboardResponse({ eventId: 999, meet: live, match: {}, grow: {} })).toThrow();
    expect(() => parseLiveDashboardResponse({ eventId: 17135, meet: live,
      match: { completedMeetings: 1, targetMeetings: null },
      grow: { feedbackCount: 0, averageRating: 4 },
    })).toThrow();
  });
});
