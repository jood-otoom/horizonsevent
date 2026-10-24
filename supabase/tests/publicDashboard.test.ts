import { describe, expect, it, vi } from "vitest";
import { publicDashboardResponse, type PublicDashboardClient } from "../functions/_shared/publicDashboard.ts";

const aggregate = {
  event_id: 17135, registered: 202, checked_in: 0, check_in_rate: 0,
  last_successful_sync: "2026-10-15T22:14:50Z", meet_failed_at: null,
  completed_meetings: 3, feedback_count: 2, rating_sum: 9,
};
const settings = { event_id: 17135, meeting_target: 1200, meet_verified: true, max_meet_age_seconds: 300 };

function client(rows: Record<string, unknown> = { dashboard_aggregates: aggregate, event_settings: settings }) {
  const queries: Array<{ table: string; columns: string; eventId: number }> = [];
  const db = { from: (table: string) => ({ select: (columns: string) => ({
    eq: (_column: string, eventId: number) => ({ single: async () => {
      queries.push({ table, columns, eventId });
      return { data: rows[table] ?? null, error: null };
    } }),
  }) }) } as PublicDashboardClient;
  return { db, queries };
}

describe("public dashboard boundary", () => {
  it("allows only GET and never queries the database for a mutation", async () => {
    const { db, queries } = client();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const result = await publicDashboardResponse(new Request("https://example.test", { method }), db, "snapshot");
      expect(result.status).toBe(405);
    }
    expect(queries).toHaveLength(0);
  });

  it("returns only the fixed event aggregate and retains snapshot semantics", async () => {
    const { db, queries } = client();
    const result = await publicDashboardResponse(new Request("https://example.test"), db, "snapshot");
    expect(result.status).toBe(200);
    const payload = await result.json();
    expect(payload).toEqual({
      eventId: 17135,
      meet: { registered: 202, checkedIn: 0, checkInRate: 0, publishedAt: aggregate.last_successful_sync,
        verification: "approved", status: "snapshot" },
      match: { completedMeetings: 3, targetMeetings: 1200 },
      grow: { feedbackCount: 2, averageRating: 4.5 },
    });
    expect(queries.map(({ table, eventId }) => [table, eventId])).toEqual([
      ["dashboard_aggregates", 17135], ["event_settings", 17135],
    ]);
    expect(queries[0].columns).not.toContain("staff_id");
    expect(JSON.stringify(payload)).not.toMatch(/staff|email|history|apiCheckedIn|rating_sum/);
  });

  it("returns a generic error for missing or malformed data", async () => {
    const missing = await publicDashboardResponse(new Request("https://example.test"), client({}).db, "sync");
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ error: "data_unavailable" });
    const malformed = await publicDashboardResponse(new Request("https://example.test"), client({
      dashboard_aggregates: { ...aggregate, rating_sum: 100 }, event_settings: settings,
    }).db, "sync");
    expect(malformed.status).toBe(503);
    expect(await malformed.json()).toEqual({ error: "data_unavailable" });
  });

  it("handles database failures without exposing details", async () => {
    const { db } = client();
    const failing = vi.spyOn(db, "from").mockImplementation(() => { throw new Error("private database detail"); });
    const response = await publicDashboardResponse(new Request("https://example.test"), db, "sync");
    expect(failing).toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
});
