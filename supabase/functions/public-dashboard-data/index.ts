import { withSupabase } from "@supabase/server";
import { withApprovedOrigin } from "../_shared/cors.ts";
import { publicDashboardResponse, type PublicDashboardClient } from "../_shared/publicDashboard.ts";

const publicRead = withSupabase({ auth: "none", cors: "disabled" }, (request, ctx) =>
  publicDashboardResponse(
    request,
    ctx.supabaseAdmin as unknown as PublicDashboardClient,
    Deno.env.get("B2MATCH_SYNC_ENABLED") === "true" ? "sync" : "snapshot",
  ));

export default {
  fetch(request: Request) {
    return withApprovedOrigin(request, Deno.env.get("DASHBOARD_ALLOWED_ORIGINS"), "GET, OPTIONS", () => publicRead(request));
  },
};
