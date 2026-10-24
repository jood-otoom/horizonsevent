import { supabasePublishableKey, supabaseUrl } from "../lib/supabaseClient";
import type { DashboardMetrics, MeetMetrics } from "../types/dashboard";

export function getMockMeetMetrics(now = new Date()): MeetMetrics {
  return {
    dataMode: "mock", status: "mock", registered: 120, checkedIn: 35,
    checkInRate: 29, asOf: now.toISOString(),
  };
}

export function parseLiveMeetResponse(value: unknown): MeetMetrics {
  if (!value || typeof value !== "object") throw new Error("Invalid MEET response.");
  const data = value as Record<string, unknown>;
  const timestamp = data.status === "snapshot" ? data.publishedAt : data.lastSuccessfulSync;
  if (!Number.isSafeInteger(data.registered) || Number(data.registered) < 0 ||
      !Number.isSafeInteger(data.checkedIn) || Number(data.checkedIn) < 0 ||
      Number(data.checkedIn) > Number(data.registered) ||
      !Number.isSafeInteger(data.checkInRate) || Number(data.checkInRate) < 0 || Number(data.checkInRate) > 100 ||
      typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)) ||
      (data.status !== "live" && data.status !== "pending" && data.status !== "stale" && data.status !== "snapshot") ||
      (data.verification !== "approved" && data.verification !== "pending") ||
      ((data.status === "live" || data.status === "snapshot") && data.verification !== "approved")) {
    throw new Error("Invalid MEET response.");
  }
  const registered = Number(data.registered);
  const checkedIn = Number(data.checkedIn);
  if (Number(data.checkInRate) !== (registered === 0 ? 0 : Math.round(checkedIn / registered * 100))) {
    throw new Error("Invalid MEET percentage.");
  }
  return {
    dataMode: "live", status: data.status,
    registered, checkedIn, checkInRate: Number(data.checkInRate), asOf: timestamp,
  };
}

export function parseLiveDashboardResponse(value: unknown): DashboardMetrics {
  if (!value || typeof value !== "object") throw new Error("Invalid dashboard response.");
  const body = value as Record<string, unknown>;
  const match = body.match as Record<string, unknown> | null;
  const grow = body.grow as Record<string, unknown> | null;
  if (body.eventId !== 17135 || !match || !grow ||
      !Number.isSafeInteger(match.completedMeetings) || Number(match.completedMeetings) < 0 ||
      (match.targetMeetings !== null && (!Number.isSafeInteger(match.targetMeetings) || Number(match.targetMeetings) < 0)) ||
      !Number.isSafeInteger(grow.feedbackCount) || Number(grow.feedbackCount) < 0 ||
      (Number(grow.feedbackCount) === 0 ? grow.averageRating !== null :
        typeof grow.averageRating !== "number" || !Number.isFinite(grow.averageRating) ||
        grow.averageRating < 1 || grow.averageRating > 5)) {
    throw new Error("Invalid dashboard response.");
  }
  return {
    dataMode: "live",
    meet: body.meet === null
      ? { status: "error", message: "Attendance has not synchronized yet." }
      : { status: "ready", data: parseLiveMeetResponse(body.meet) },
    match: {
      dataMode: "live", status: "live",
      completedMeetings: Number(match.completedMeetings),
      targetMeetings: match.targetMeetings === null ? null : Number(match.targetMeetings),
    },
    grow: {
      dataMode: "live", status: "live", maximumRating: 5,
      feedbackCount: Number(grow.feedbackCount),
      averageRating: grow.averageRating === null ? null : Number(grow.averageRating),
    },
  };
}

export async function fetchLiveDashboard(fetcher: typeof fetch = fetch): Promise<DashboardMetrics> {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Live configuration is missing.");
  const response = await fetcher(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/public-dashboard-data`, {
    method: "GET",
    headers: { apikey: supabasePublishableKey },
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Dashboard data is unavailable.");
  return parseLiveDashboardResponse(await response.json());
}
