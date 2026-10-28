import { withSupabase } from "@supabase/server";
import { parseDispatch, runMeetSync, workerAuthorized, type SyncDatabase } from "../_shared/meetSync.ts";

const worker = withSupabase({ auth: "none", cors: "disabled" }, async (request, ctx) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (Deno.env.get("B2MATCH_EVENT_ID") !== "17135") {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
  let dispatch;
  try {
    const body = await request.text();
    if (body.length > 256) throw new Error("invalid_dispatch");
    dispatch = parseDispatch(JSON.parse(body));
  } catch {
    return Response.json({ error: "invalid_dispatch" }, { status: 400 });
  }
  return runMeetSync(ctx.supabaseAdmin as unknown as SyncDatabase, {
    apiKey: Deno.env.get("B2MATCH_API_KEY") ?? "", eventId: "17135", generation: dispatch.generation,
  });
});

export default {
  async fetch(request: Request) {
    if (!await workerAuthorized(request, Deno.env.get("B2MATCH_WORKER_SECRET"))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return worker(request);
  },
};
