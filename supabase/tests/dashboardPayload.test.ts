import { describe, expect, it } from "vitest";
import { makeDashboardPayload } from "../functions/_shared/dashboardPayload.ts";

const row = {
  event_id: 17135, registered: 10, checked_in: 7, check_in_rate: 70,
  last_successful_sync: "2026-10-10T10:00:00Z", meet_failed_at: null,
  completed_meetings: 3, feedback_count: 2, rating_sum: 9,
};
const settings = { event_id: 17135, meeting_target: null, meet_verified: false, max_meet_age_seconds: 300 };

describe("safe dashboard payload", () => {
  it("keeps a complete but unverified snapshot pending", () => {
    const payload = makeDashboardPayload(row, settings, Date.parse("2026-10-10T10:01:00Z"));
    expect(payload.meet?.status).toBe("pending");
    expect(payload.match).toEqual({ completedMeetings: 3, targetMeetings: null });
    expect(payload.grow).toEqual({ feedbackCount: 2, averageRating: 4.5 });
    expect(JSON.stringify(payload)).not.toContain("staff_id");
  });

  it("uses live only after verification and freshness checks", () => {
    expect(makeDashboardPayload(row, { ...settings, meet_verified: true }, Date.parse("2026-10-10T10:01:00Z")).meet?.status).toBe("live");
    expect(makeDashboardPayload(row, { ...settings, meet_verified: true }, Date.parse("2026-10-10T10:06:00Z")).meet?.status).toBe("stale");
    expect(makeDashboardPayload({ ...row, meet_failed_at: "2026-10-10T10:00:30Z" },
      { ...settings, meet_verified: true }, Date.parse("2026-10-10T10:01:00Z")).meet?.status).toBe("stale");
  });

  it("marks an owner-confirmed one-time publication as a snapshot while sync is disabled", () => {
    const payload = makeDashboardPayload({ ...row, registered: 202, checked_in: 0, check_in_rate: 0 },
      { ...settings, meet_verified: true }, Date.parse("2026-10-10T10:01:00Z"), "snapshot");
    expect(payload.meet).toMatchObject({
      registered: 202, checkedIn: 0, checkInRate: 0, verification: "approved",
      status: "snapshot", publishedAt: "2026-10-10T10:00:00Z",
    });
    expect(payload.meet).not.toHaveProperty("lastSuccessfulSync");
  });

  it("does not invent MEET counts before the first complete sync", () => {
    expect(makeDashboardPayload({ ...row, registered: null, checked_in: null, check_in_rate: null,
      last_successful_sync: null }, settings).meet).toBeNull();
  });
});
