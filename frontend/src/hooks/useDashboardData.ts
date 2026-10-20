import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dataMode, supabase } from "../lib/supabaseClient";
import { fetchLiveDashboard, getMockMeetMetrics } from "../services/dashboardService";
import { mockFeedbackProvider, mockMeetingProvider } from "../services/mockDashboardProvider";
import type { DashboardMetrics, MeetMetrics, MetricResource } from "../types/dashboard";

function pendingDashboard(): DashboardMetrics {
  return {
    dataMode: "live",
    meet: { status: "loading" },
    match: { dataMode: "live", status: "pending", completedMeetings: null, targetMeetings: null },
    grow: { dataMode: "live", status: "pending", feedbackCount: null, averageRating: null, maximumRating: 5 },
  };
}

function demoDashboard(): DashboardMetrics {
  return {
    dataMode: "mock",
    meet: { status: "ready", data: getMockMeetMetrics() },
    match: mockMeetingProvider.getMetrics(),
    grow: mockFeedbackProvider.getMetrics(),
  };
}

function staleMeet(previous: MetricResource<MeetMetrics>): MetricResource<MeetMetrics> {
  return previous.status === "ready" && previous.data.dataMode === "live"
    ? { status: "ready", data: { ...previous.data, status: "stale" } }
    : { status: "error", message: "Attendance data is unavailable." };
}

export default function useDashboardData(options?: { mode?: "demo" | "live"; client?: SupabaseClient }): DashboardMetrics {
  const mode = options?.mode ?? dataMode;
  const liveClient = options?.client ?? supabase;
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => mode === "live" ? pendingDashboard() : demoDashboard());

  useEffect(() => {
    if (mode !== "live") return;
    const client = liveClient;
    if (!client) {
      setMetrics((previous) => ({ ...previous, meet: { status: "error", message: "Live configuration is missing." } }));
      return;
    }
    let active = true;
    let inFlight = false;
    let refreshQueued = false;
    const refresh = async () => {
      if (inFlight) { refreshQueued = true; return; }
      inFlight = true;
      try {
        const next = await fetchLiveDashboard(client);
        if (active) setMetrics(next);
      } catch {
        if (active) setMetrics((previous) => ({
          ...previous,
          meet: staleMeet(previous.meet),
          match: { ...previous.match, status: "stale" },
          grow: { ...previous.grow, status: "stale" },
        }));
      } finally {
        inFlight = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };
    void refresh();
    // Distinct topics prevent a Strict Mode cleanup from closing the next mount's subscription.
    const channel = client.channel(`dashboard-aggregates-17135-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dashboard_aggregates", filter: "event_id=eq.17135" }, () => { void refresh(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [mode, liveClient]);

  return metrics;
}
