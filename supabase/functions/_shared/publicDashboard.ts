import { makeDashboardPayload, type AggregateRow, type SettingsRow } from "./dashboardPayload.ts";

export interface PublicDashboardClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: number): {
        single(): PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export function dashboardSourceMode(value: unknown): "sync" | "snapshot" {
  if (!value || typeof value !== "object" || !("source" in value)) throw new Error("invalid_source");
  const source = (value as { source: unknown }).source;
  if (source === "api") return "sync";
  if (source === "snapshot" || source === "manual" || source === "reset") return "snapshot";
  throw new Error("invalid_source");
}

/** The public route returns aggregate values; the private source row supplies only labeling. */
export async function publicDashboardResponse(
  request: Request,
  admin: PublicDashboardClient,
): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  try {
    const [aggregate, settings, control] = await Promise.all([
      admin.from("dashboard_aggregates")
        .select("event_id,registered,checked_in,check_in_rate,last_successful_sync,meet_failed_at,completed_meetings,feedback_count,rating_sum")
        .eq("event_id", 17135).single(),
      admin.from("event_settings")
        .select("event_id,meeting_target,meet_verified,max_meet_age_seconds")
        .eq("event_id", 17135).single(),
      admin.from("meet_checkin_control").select("source").eq("event_id", 17135).single(),
    ]);
    if (aggregate.error || settings.error || control.error || !aggregate.data || !settings.data || !control.data) {
      return Response.json({ error: "data_unavailable" }, { status: 503 });
    }
    return Response.json(makeDashboardPayload(
      aggregate.data as AggregateRow, settings.data as SettingsRow, Date.now(), dashboardSourceMode(control.data),
    ));
  } catch {
    return Response.json({ error: "data_unavailable" }, { status: 503 });
  }
}
