import { useEffect, useState } from "react";
import { dataMode, supabase, supabasePublishableKey, supabaseUrl } from "../lib/supabaseClient";
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

function sameDashboard(a: DashboardMetrics, b: DashboardMetrics): boolean {
  if (a.dataMode !== b.dataMode || a.meet.status !== b.meet.status) return false;
  if (a.meet.status === "ready" && b.meet.status === "ready") {
    const oldMeet = a.meet.data;
    const newMeet = b.meet.data;
    if (oldMeet.dataMode !== newMeet.dataMode || oldMeet.status !== newMeet.status ||
        oldMeet.registered !== newMeet.registered || oldMeet.checkedIn !== newMeet.checkedIn ||
        oldMeet.checkInRate !== newMeet.checkInRate || oldMeet.asOf !== newMeet.asOf) return false;
  } else if (a.meet.status === "error" && b.meet.status === "error" && a.meet.message !== b.meet.message) {
    return false;
  }
  return a.match.dataMode === b.match.dataMode && a.match.status === b.match.status &&
    a.match.completedMeetings === b.match.completedMeetings && a.match.targetMeetings === b.match.targetMeetings &&
    a.grow.dataMode === b.grow.dataMode && a.grow.status === b.grow.status &&
    a.grow.feedbackCount === b.grow.feedbackCount && a.grow.averageRating === b.grow.averageRating &&
    a.grow.maximumRating === b.grow.maximumRating;
}

type SubscribeToDashboard = (refresh: () => void) => () => void;

function subscribeToDashboard(refresh: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client.channel("public-event-17135")
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "dashboard_aggregates", filter: "event_id=eq.17135",
    }, refresh)
    .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
  return () => { void client.removeChannel(channel); };
}

export default function useDashboardData(options?: {
  mode?: "demo" | "live";
  load?: typeof fetchLiveDashboard;
  subscribe?: SubscribeToDashboard;
}): DashboardMetrics {
  const mode = options?.mode ?? dataMode;
  const load = options?.load ?? fetchLiveDashboard;
  const subscribe = options?.subscribe ?? subscribeToDashboard;
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => mode === "live" ? pendingDashboard() : demoDashboard());

  useEffect(() => {
    if (mode !== "live") return;
    if (load === fetchLiveDashboard && (!supabaseUrl || !supabasePublishableKey)) {
      setMetrics((previous) => ({
        ...previous,
        meet: { status: "error", message: "Live configuration is missing." },
        match: { ...previous.match, status: "stale" },
        grow: { ...previous.grow, status: "stale" },
      }));
      return;
    }
    let active = true;
    let inFlight = false;
    let refreshQueued = false;
    const refresh = async () => {
      if (inFlight) { refreshQueued = true; return; }
      inFlight = true;
      try {
        const next = await load();
        if (active) setMetrics((previous) => sameDashboard(previous, next) ? previous : next);
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
    const onReconnect = () => { void refresh(); };
    window.addEventListener("online", onReconnect);
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    // Realtime is a notification only; every update refetches the validated public payload.
    const unsubscribe = subscribe(onReconnect);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("online", onReconnect);
    };
  }, [mode, load, subscribe]);

  return metrics;
}
