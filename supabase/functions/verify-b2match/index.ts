import { withSupabase } from "@supabase/server";
import { safeDryRunFailure, verifyB2matchReadOnly } from "../_shared/dryRunVerification.ts";
import { handleNamedSecretRequest } from "../_shared/namedSecretAuth.ts";

const secured = withSupabase({ auth: "secret:b2match_verification", cors: "disabled" }, async (request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (Deno.env.get("B2MATCH_DRY_RUN_ENABLED") !== "true" || Deno.env.get("B2MATCH_EVENT_ID") !== "17135") {
    return Response.json({ status: "disabled" }, { status: 503 });
  }
  const apiKey = Deno.env.get("B2MATCH_API_KEY");
  if (!apiKey) return Response.json({ status: "unavailable" }, { status: 503 });
  const started = performance.now();
  try {
    const result = await verifyB2matchReadOnly({ apiKey, eventId: "17135" });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // 424 is a safe, authenticated diagnostic; the outer guard masks arbitrary 5xx bodies.
    return Response.json(safeDryRunFailure(error, performance.now() - started), {
      status: 424,
      headers: { "cache-control": "no-store" },
    });
  }
});

export default {
  async fetch(request: Request) {
    return handleNamedSecretRequest(
      request,
      "b2match_verification",
      Deno.env.get("SUPABASE_SECRET_KEYS"),
      secured,
    );
  },
};
