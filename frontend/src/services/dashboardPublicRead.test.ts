import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("public dashboard HTTP read", () => {
  it("uses only the publishable key and validates the response", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { fetchLiveDashboard } = await import("./dashboardService");
    const fetcher = vi.fn(async () => Response.json({
      eventId: 17135, meet: null,
      match: { completedMeetings: 2, targetMeetings: 1200 },
      grow: { feedbackCount: 0, averageRating: null },
    }));
    const dashboard = await fetchLiveDashboard(fetcher);
    expect(dashboard.match.completedMeetings).toBe(2);
    expect(fetcher).toHaveBeenCalledWith("https://example.supabase.co/functions/v1/public-dashboard-data", {
      method: "GET", headers: { apikey: "sb_publishable_test" }, credentials: "omit", cache: "no-store",
    });
  });

  it("rejects API errors and invalid payloads without substituting demo counts", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { fetchLiveDashboard } = await import("./dashboardService");
    await expect(fetchLiveDashboard(async () => Response.json({ error: "data_unavailable" }, { status: 503 })))
      .rejects.toThrow("Dashboard data is unavailable.");
    await expect(fetchLiveDashboard(async () => Response.json({ eventId: 999 }))).rejects.toThrow();
  });
});
