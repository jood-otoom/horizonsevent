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

/** The public route reads only the two event-scoped aggregate projections. */
export async function publicDashboardResponse(
  request: Request,
  admin: PublicDashboardClient,
  sourceMode: "sync" | "snapshot",
): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  try {
    const [aggregate, settings] = await Promise.all([
      admin.from("dashboard_aggregates")
        .select("event_id,registered,checked_in,check_in_rate,last_successful_sync,meet_failed_at,completed_meetings,feedback_count,rating_sum")
        .eq("event_id", 17135).single(),
      admin.from("event_settings")
        .select("event_id,meeting_target,meet_verified,max_meet_age_seconds")
        .eq("event_id", 17135).single(),
    ]);
    if (aggregate.error || settings.error || !aggregate.data || !settings.data) {
      return Response.json({ error: "data_unavailable" }, { status: 503 });
    }
    return Response.json(makeDashboardPayload(
      aggregate.data as AggregateRow, settings.data as SettingsRow, Date.now(), sourceMode,
    ));
  } catch {
    return Response.json({ error: "data_unavailable" }, { status: 503 });
  }
}
