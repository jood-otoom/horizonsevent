import { withSupabase } from "@supabase/server";
import { allowedRole, type MembershipClient } from "../_shared/authorization.ts";
import { parseSubmission } from "../_shared/controllerPayload.ts";
import { withApprovedOrigin } from "../_shared/cors.ts";

const secured = withSupabase({ auth: "user", cors: "disabled" }, async (request, ctx) => {
  if (request.method !== "POST" && request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  const userId = ctx.userClaims?.id;
  let permitted: boolean;
  try {
    permitted = !!userId && await allowedRole(ctx.supabase as unknown as MembershipClient, userId, ["staff", "admin"]);
  } catch {
    return Response.json({ error: "access_unavailable" }, { status: 503 });
  }
  if (!userId || !permitted) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (request.method === "GET") {
    const { data, error } = await ctx.supabaseAdmin.rpc("list_controller_actions", {
      p_event_id: 17135, p_staff_id: userId,
    });
    return error || !Array.isArray(data)
      ? Response.json({ error: "history_unavailable" }, { status: 503 })
      : Response.json({ actions: data });
  }
  if (Number(request.headers.get("content-length")) > 1024) {
    return Response.json({ error: "invalid_submission" }, { status: 400 });
  }
  let submission;
  try {
    const body = await request.text();
    if (body.length > 1024) throw new Error("too_large");
    submission = parseSubmission(JSON.parse(body));
  } catch {
    return Response.json({ error: "invalid_submission" }, { status: 400 });
  }
  const rpc = submission.kind === "meeting"
    ? await ctx.supabaseAdmin.rpc("record_meetings", {
      p_event_id: 17135, p_request_id: submission.requestId,
      p_staff_id: userId, p_quantity: submission.quantity,
    })
    : submission.kind === "feedback" ? await ctx.supabaseAdmin.rpc("record_feedback", {
      p_event_id: 17135, p_request_id: submission.requestId,
      p_staff_id: userId, p_rating: submission.rating,
    }) : await ctx.supabaseAdmin.rpc("reverse_controller_action", {
      p_event_id: 17135, p_original_request_id: submission.originalRequestId,
      p_reversal_request_id: submission.requestId, p_staff_id: userId,
      p_reason: submission.reason,
    });
  if (rpc.error) {
    const conflict = rpc.error.message.includes("request_conflict") ||
      rpc.error.message.includes("already_reversed");
    return Response.json({ error: conflict ? "request_conflict" : "submission_failed" },
      { status: conflict ? 409 : 503 });
  }
  const { data, error } = await ctx.supabaseAdmin.from("dashboard_aggregates")
    .select("completed_meetings,feedback_count,rating_sum").eq("event_id", 17135).single();
  if (error || !data || !rpc.data || typeof rpc.data !== "object") {
    return Response.json({ error: "submission_unconfirmed" }, { status: 503 });
  }
  const result = rpc.data as { id: string; createdAt: string; rating?: number; originalRequestId?: string };
  if (submission.kind === "undo") {
    return Response.json({
      reversal: { id: result.id, originalRequestId: result.originalRequestId, createdAt: result.createdAt },
      stats: {
        dataMode: "live", completedMeetings: data.completed_meetings,
        feedbackCount: data.feedback_count,
        averageRating: data.feedback_count === 0 ? null : data.rating_sum / data.feedback_count,
      },
    });
  }
  return Response.json({
    record: submission.kind === "feedback"
      ? { id: result.id, createdAt: result.createdAt, rating: submission.rating }
      : { id: result.id, createdAt: result.createdAt },
    stats: {
      dataMode: "live",
      completedMeetings: data.completed_meetings,
      feedbackCount: data.feedback_count,
      averageRating: data.feedback_count === 0 ? null : data.rating_sum / data.feedback_count,
    },
  });
});

export default {
  fetch(request: Request) {
    return withApprovedOrigin(request, Deno.env.get("DASHBOARD_ALLOWED_ORIGINS"), "GET, POST, OPTIONS", () => secured(request));
  },
};
