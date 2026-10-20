import { withSupabase } from "@supabase/server";
import { B2matchSyncError, fetchAllParticipantsWithStats } from "../_shared/b2matchClient.ts";
import { aggregateMeet } from "../_shared/meetAggregation.ts";
import { handleNamedSecretRequest } from "../_shared/namedSecretAuth.ts";

const secured = withSupabase({ auth: "secret:automations", cors: "disabled" }, async (request, ctx) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (Deno.env.get("B2MATCH_SYNC_ENABLED") !== "true" || Deno.env.get("B2MATCH_EVENT_ID") !== "17135") {
    return Response.json({ status: "disabled" }, { status: 503 });
  }
  const runId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const claim = await ctx.supabaseAdmin.rpc("claim_meet_sync", {
    p_event_id: 17135, p_run_id: runId, p_token: token,
  });
  if (claim.error) return Response.json({ status: "unavailable" }, { status: 503 });
  if (claim.data !== true) return Response.json({ status: "already_running" }, { status: 409 });
  try {
    const result = await fetchAllParticipantsWithStats({
      apiKey: Deno.env.get("B2MATCH_API_KEY") ?? "",
      eventId: "17135",
    });
    const counts = aggregateMeet(result.participants);
    const publication = await ctx.supabaseAdmin.rpc("complete_meet_sync", {
      p_run_id: runId, p_token: token, p_registered: counts.registered,
      p_checked_in: counts.checkedIn, p_pages: result.pagesProcessed,
      p_records: result.recordsProcessed,
    });
    if (publication.error || publication.data !== true) throw new B2matchSyncError("publication_failed");
    return Response.json({ status: "complete", pagesProcessed: result.pagesProcessed,
      recordsProcessed: result.recordsProcessed });
  } catch (error) {
    const code = error instanceof B2matchSyncError ? error.code : "unknown";
    await ctx.supabaseAdmin.rpc("fail_meet_sync", {
      p_run_id: runId, p_token: token, p_error: code,
      p_pages: error instanceof B2matchSyncError ? error.pagesProcessed : 0,
      p_records: error instanceof B2matchSyncError ? error.recordsProcessed : 0,
    });
    return Response.json({ status: "failed" }, { status: 502 });
  }
});

export default {
  async fetch(request: Request) {
    return handleNamedSecretRequest(request, "automations", Deno.env.get("SUPABASE_SECRET_KEYS"), secured);
  },
};
