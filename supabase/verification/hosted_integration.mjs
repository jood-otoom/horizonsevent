// Run only against the empty, owner-approved test project. API keys arrive on stdin
// from the authenticated CLI and are never written to disk or printed.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import process from "node:process";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const projectUrl = "https://kkiambvltxuieuncwtfz.supabase.co";
const eventId = 17135;
const origin = "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`PASS ${label}`);
}

function client(key) {
  return createClient(projectUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

async function request(path, publishableKey, jwt, method = "GET", body, requestOrigin = origin) {
  const headers = { apikey: publishableKey, Origin: requestOrigin };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${projectUrl}/functions/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data, headers: response.headers };
}

async function tableCount(db, table) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`preflight_${table}`);
  return count;
}

async function subscribe(db, label, events) {
  const channel = db.channel(`nh-verification-${label}-${randomUUID()}`)
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "dashboard_aggregates", filter: `event_id=eq.${eventId}`,
    }, (payload) => events.push(payload.new));
  let settled = false;
  const joined = new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (settled) return;
      if (status === "SUBSCRIBED") { settled = true; resolve(true); }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        settled = true; reject(new Error(`realtime_${label}_${status.toLowerCase()}`));
      }
    });
  });
  await Promise.race([joined, sleep(12000).then(() => { throw new Error(`realtime_${label}_timeout`); })]);
  return channel;
}

async function waitForEvent(events, minimum) {
  for (let i = 0; i < 30 && events.length < minimum; i++) await sleep(200);
  return events.length >= minimum;
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const keys = JSON.parse(input);
  const publishableKey = keys.find((entry) => entry.type === "publishable" && entry.name === "default" && !entry.disabled)?.api_key;
  const secretKey = keys.find((entry) => entry.type === "secret" && entry.name === "default" && !entry.disabled)?.api_key;
  if (!publishableKey || !secretKey) throw new Error("required_project_keys_unavailable");

  const admin = client(secretKey);
  const users = [];
  const channels = [];
  const clients = [];
  const requestIds = [];
  let testMeetingQuantity = 0;
  let testFeedbackCount = 0;
  let testRatingSum = 0;
  let testStarted = false;
  try {
    for (const table of ["event_memberships", "controller_requests", "meeting_records", "feedback_records", "sync_runs", "meet_snapshots"]) {
      assert(await tableCount(admin, table) === 0, `empty ${table}`);
    }
    const { data: start, error: startError } = await admin.from("dashboard_aggregates")
      .select("completed_meetings,feedback_count,rating_sum,registered").eq("event_id", eventId).single();
    assert(!startError && start.completed_meetings === 0 && start.feedback_count === 0 && start.rating_sum === 0 && start.registered === null, "empty aggregate baseline");
    testStarted = true;

    const sessions = {};
    for (const role of ["viewer", "staff", "admin", "unassigned"]) {
      const email = `nh-verification-${randomUUID()}@example.invalid`;
      const password = `${randomUUID()}Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`create_${role}`);
      users.push(created.data.user.id);
      if (role !== "unassigned") {
        const membership = await admin.from("event_memberships").insert({ event_id: eventId, user_id: created.data.user.id, role });
        if (membership.error) throw new Error(`membership_${role}`);
      }
      const db = client(publishableKey);
      clients.push(db);
      const signed = await db.auth.signInWithPassword({ email, password });
      if (signed.error || !signed.data.session?.access_token) throw new Error(`signin_${role}`);
      sessions[role] = {
        db, jwt: signed.data.session.access_token,
        refreshToken: signed.data.session.refresh_token, userId: created.data.user.id,
      };
      console.log(`PASS ${role} Auth sign-in`);
    }

    const anonymous = await request("dashboard-data", publishableKey, null);
    assert(anonymous.status === 401, "anonymous dashboard denied");
    const invalid = await request("dashboard-data", publishableKey, "invalid.jwt.token");
    assert(invalid.status === 401, "invalid JWT denied");
    const outsider = await request("dashboard-data", publishableKey, sessions.unassigned.jwt);
    assert(outsider.status === 403, "unassigned dashboard denied");
    for (const role of ["viewer", "staff", "admin"]) {
      const response = await request("dashboard-data", publishableKey, sessions[role].jwt);
      assert(response.status === 200 && response.data?.eventId === eventId && response.data?.meet === null, `${role} dashboard aggregate access`);
    }
    const badOrigin = await request("dashboard-data", publishableKey, sessions.viewer.jwt, "GET", null, "https://unapproved.example");
    assert(badOrigin.status === 403, "unapproved browser origin denied");
    const syncAnonymous = await request("sync-b2match", publishableKey, null, "POST");
    assert(syncAnonymous.status === 401 || syncAnonymous.status === 403, "anonymous sync denied");

    for (const role of ["viewer", "unassigned"]) {
      const denied = await request("controller-submit", publishableKey, sessions[role].jwt, "POST", { kind: "meeting", eventId, quantity: 1, requestId: randomUUID() });
      assert(denied.status === 403, `${role} controller denied`);
    }
    const deniedEvent = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "meeting", eventId: 17136, quantity: 1, requestId: randomUUID() });
    assert(deniedEvent.status === 400, "other event submission denied");
    const deniedRating = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "feedback", eventId, rating: 6, requestId: randomUUID() });
    assert(deniedRating.status === 400, "rating outside 1–5 denied");

    const browserWrite = await sessions.staff.db.from("meeting_records").insert({ event_id: eventId, request_id: randomUUID(), ordinal: 1, staff_id: sessions.staff.userId });
    assert(!!browserWrite.error, "direct browser write denied");
    const browserRpc = await sessions.staff.db.rpc("claim_meet_sync", { p_event_id: eventId, p_run_id: randomUUID(), p_token: randomUUID() });
    assert(!!browserRpc.error, "sync transaction RPC denied to staff");
    const privateRows = await sessions.viewer.db.from("sync_runs").select("id");
    assert(!!privateRows.error, "sync logs denied to viewer");
    const outsideEvent = await sessions.viewer.db.from("dashboard_aggregates").select("event_id").eq("event_id", 17136);
    assert(!outsideEvent.error && outsideEvent.data.length === 0, "event boundary enforced");

    const viewerEvents = [];
    const outsiderEvents = [];
    channels.push([sessions.viewer.db, await subscribe(sessions.viewer.db, "viewer", viewerEvents)]);
    channels.push([sessions.unassigned.db, await subscribe(sessions.unassigned.db, "outsider", outsiderEvents)]);

    for (const quantity of [1, 2, 3]) {
      const requestId = randomUUID();
      requestIds.push(requestId);
      const result = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "meeting", eventId, quantity, requestId });
      assert(result.status === 200 && result.data?.stats?.completedMeetings === testMeetingQuantity + quantity, `staff meeting +${quantity}`);
      testMeetingQuantity += quantity;
      const duplicate = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "meeting", eventId, quantity, requestId });
      assert(duplicate.status === 200 && duplicate.data?.stats?.completedMeetings === testMeetingQuantity, `meeting +${quantity} idempotent retry`);
      const conflict = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "meeting", eventId, quantity: quantity === 1 ? 2 : 1, requestId });
      assert(conflict.status === 409, `meeting +${quantity} request conflict`);
    }
    assert(await waitForEvent(viewerEvents, 1), "authorized Realtime aggregate delivery");
    await sleep(800);
    assert(outsiderEvents.length === 0, "unassigned Realtime receives no aggregate row");

    // A fresh client socket with the same valid session simulates reconnection.
    await sessions.viewer.db.removeChannel(channels[0][1]);
    channels.shift();
    const reconnected = client(publishableKey);
    clients.push(reconnected);
    const restored = await reconnected.auth.setSession({
      access_token: sessions.viewer.jwt, refresh_token: sessions.viewer.refreshToken,
    });
    assert(!restored.error, "viewer session restored on fresh client");
    channels.push([reconnected, await subscribe(reconnected, "rejoined", viewerEvents)]);
    const beforeRejoinedUpdates = viewerEvents.length;

    for (const rating of [1, 2, 3, 4, 5]) {
      const requestId = randomUUID();
      requestIds.push(requestId);
      const result = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "feedback", eventId, rating, requestId });
      testFeedbackCount += 1;
      testRatingSum += rating;
      assert(result.status === 200 && result.data?.stats?.feedbackCount === testFeedbackCount && result.data?.stats?.averageRating === testRatingSum / testFeedbackCount, `staff feedback ${rating}`);
      const duplicate = await request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "feedback", eventId, rating, requestId });
      assert(duplicate.status === 200 && duplicate.data?.stats?.feedbackCount === testFeedbackCount, `feedback ${rating} idempotent retry`);
    }
    assert(await waitForEvent(viewerEvents, beforeRejoinedUpdates + 1), "Realtime delivery after client reconnection");
    const adminRequestId = randomUUID();
    requestIds.push(adminRequestId);
    const adminSubmit = await request("controller-submit", publishableKey, sessions.admin.jwt, "POST", { kind: "meeting", eventId, quantity: 1, requestId: adminRequestId });
    assert(adminSubmit.status === 200 && adminSubmit.data?.stats?.completedMeetings === 7, "admin controller submission");
    testMeetingQuantity += 1;

    const simultaneousId = randomUUID();
    requestIds.push(simultaneousId);
    const simultaneousBody = { kind: "meeting", eventId, quantity: 1, requestId: simultaneousId };
    const duplicatePair = await Promise.all([
      request("controller-submit", publishableKey, sessions.staff.jwt, "POST", simultaneousBody),
      request("controller-submit", publishableKey, sessions.staff.jwt, "POST", simultaneousBody),
    ]);
    assert(duplicatePair.every((entry) => entry.status === 200), "simultaneous duplicate requests accepted idempotently");
    testMeetingQuantity += 1;
    const distinctIds = [randomUUID(), randomUUID()];
    requestIds.push(...distinctIds);
    const distinctPair = await Promise.all([
      request("controller-submit", publishableKey, sessions.staff.jwt, "POST", { kind: "meeting", eventId, quantity: 1, requestId: distinctIds[0] }),
      request("controller-submit", publishableKey, sessions.admin.jwt, "POST", { kind: "meeting", eventId, quantity: 1, requestId: distinctIds[1] }),
    ]);
    assert(distinctPair.every((entry) => entry.status === 200), "simultaneous distinct staff and admin submissions persisted");
    testMeetingQuantity += 2;

    const persisted = await admin.from("dashboard_aggregates").select("completed_meetings,feedback_count,rating_sum").eq("event_id", eventId).single();
    assert(!persisted.error && persisted.data.completed_meetings === 10 && persisted.data.feedback_count === 5 && persisted.data.rating_sum === 15, "PostgreSQL aggregates persisted");
    assert(await tableCount(admin, "meeting_records") === 10, "ten meeting records persisted");
    assert(await tableCount(admin, "feedback_records") === 5, "five feedback records persisted");
    const polling = await request("dashboard-data", publishableKey, sessions.viewer.jwt);
    assert(polling.status === 200 && polling.data?.match?.completedMeetings === 10 && polling.data?.grow?.feedbackCount === 5, "dashboard polling returns authoritative aggregates");
    assert(polling.data?.meet === null, "unverified MEET remains unavailable");
  } finally {
    for (const [db, channel] of channels) await db.removeChannel(channel).catch(() => {});
    for (const db of clients) await db.removeAllChannels().catch(() => {});
    if (testStarted) {
      const ids = users.filter(Boolean);
      let actualMeetings = 0;
      let actualFeedbackCount = 0;
      let actualRatingSum = 0;
      let cleanupFailed = false;
      if (requestIds.length) {
        const meetingRows = await admin.from("meeting_records").select("id").in("request_id", requestIds);
        const feedbackRows = await admin.from("feedback_records").select("id,rating").in("request_id", requestIds);
        if (meetingRows.error || feedbackRows.error) {
          cleanupFailed = true;
          console.error("CLEANUP_FAILED count_records");
        } else {
          actualMeetings = meetingRows.data.length;
          actualFeedbackCount = feedbackRows.data.length;
          actualRatingSum = feedbackRows.data.reduce((sum, row) => sum + row.rating, 0);
        }
        for (const table of ["meeting_records", "feedback_records", "controller_requests"]) {
          const deleted = await admin.from(table).delete().in("request_id", requestIds);
          if (deleted.error) { cleanupFailed = true; console.error(`CLEANUP_FAILED ${table}`); }
        }
      }
      if (actualMeetings || actualFeedbackCount) {
        const before = await admin.from("dashboard_aggregates").select("completed_meetings,feedback_count,rating_sum").eq("event_id", eventId).single();
        if (!before.error && before.data.completed_meetings >= actualMeetings && before.data.feedback_count >= actualFeedbackCount && before.data.rating_sum >= actualRatingSum) {
          const reset = await admin.from("dashboard_aggregates").update({
            completed_meetings: before.data.completed_meetings - actualMeetings,
            feedback_count: before.data.feedback_count - actualFeedbackCount,
            rating_sum: before.data.rating_sum - actualRatingSum,
          }).eq("event_id", eventId).eq("completed_meetings", before.data.completed_meetings)
            .eq("feedback_count", before.data.feedback_count).eq("rating_sum", before.data.rating_sum).select("event_id");
          if (reset.error || reset.data?.length !== 1) { cleanupFailed = true; console.error("CLEANUP_FAILED aggregate"); }
        } else { cleanupFailed = true; console.error("CLEANUP_FAILED aggregate_precondition"); }
      }
      if (ids.length) {
        const membership = await admin.from("event_memberships").delete().in("user_id", ids);
        if (membership.error) { cleanupFailed = true; console.error("CLEANUP_FAILED memberships"); }
      }
      for (const id of users) {
        const deleted = await admin.auth.admin.deleteUser(id);
        if (deleted.error) { cleanupFailed = true; console.error("CLEANUP_FAILED disposable_user"); }
      }
      if (cleanupFailed) {
        console.error("FAIL synthetic_cleanup_incomplete");
        process.exitCode = 1;
      } else console.log("PASS synthetic identities and records cleaned up");
    }
  }
}

main().catch((error) => {
  // Error labels are generated by this script. Never print upstream error bodies or keys.
  console.error(`FAIL ${error.message.startsWith("realtime_") ? error.message : error.message.replace(/[^a-zA-Z0-9_ +–-]/g, "")}`);
  process.exitCode = 1;
});
