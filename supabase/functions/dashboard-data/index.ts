import { withSupabase } from "@supabase/server";
import { allowedRole, type MembershipClient } from "../_shared/authorization.ts";
import { withApprovedOrigin } from "../_shared/cors.ts";
import { dashboardSourceMode } from "../_shared/publicDashboard.ts";
import { makeDashboardPayload } from "../_shared/dashboardPayload.ts";

const secured = withSupabase({ auth: "user", cors: "disabled" }, async (request, ctx) => {
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  const userId = ctx.userClaims?.id;
  let permitted: boolean;
  try {
    permitted = !!userId && await allowedRole(ctx.supabase as unknown as MembershipClient, userId, ["viewer", "staff", "admin"]);
  } catch {
    return Response.json({ error: "access_unavailable" }, { status: 503 });
  }
  if (!permitted) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const [aggregate, settings, control] = await Promise.all([
    ctx.supabase.from("dashboard_aggregates").select("event_id,registered,checked_in,check_in_rate,last_successful_sync,meet_failed_at,completed_meetings,feedback_count,rating_sum").eq("event_id", 17135).single(),
    ctx.supabase.from("event_settings").select("event_id,meeting_target,meet_verified,max_meet_age_seconds").eq("event_id", 17135).single(),
    ctx.supabaseAdmin.from("meet_checkin_control").select("source").eq("event_id", 17135).single(),
  ]);
  if (aggregate.error || settings.error || control.error || !aggregate.data || !settings.data || !control.data) {
    return Response.json({ error: "data_unavailable" }, { status: 503 });
  }
  try {
    return Response.json(makeDashboardPayload(
      aggregate.data,
      settings.data,
      Date.now(),
      dashboardSourceMode(control.data),
    ));
  } catch {
    return Response.json({ error: "data_unavailable" }, { status: 503 });
  }
});

export default {
  fetch(request: Request) {
    return withApprovedOrigin(request, Deno.env.get("DASHBOARD_ALLOWED_ORIGINS"), "GET, OPTIONS", () => secured(request));
  },
};
