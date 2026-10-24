import { withSupabase } from "@supabase/server";
import { withApprovedOrigin } from "../_shared/cors.ts";
import { publicDashboardResponse, type PublicDashboardClient } from "../_shared/publicDashboard.ts";

const PUBLIC_DASHBOARD_ORIGIN = "https://horizonsevent.pages.dev";

const publicRead = withSupabase({ auth: "none", cors: "disabled" }, (request, ctx) =>
  publicDashboardResponse(
    request,
    ctx.supabaseAdmin as unknown as PublicDashboardClient,
    Deno.env.get("B2MATCH_SYNC_ENABLED") === "true" ? "sync" : "snapshot",
  ));

export default {
  fetch(request: Request) {
    const allowedOrigins = `${Deno.env.get("DASHBOARD_ALLOWED_ORIGINS") ?? ""},${PUBLIC_DASHBOARD_ORIGIN}`;
    return withApprovedOrigin(request, allowedOrigins, "GET, OPTIONS", () => publicRead(request));
  },
};
