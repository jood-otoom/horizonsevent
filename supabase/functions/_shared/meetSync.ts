import { B2matchSyncError, fetchAllParticipantsWithStats, type B2matchClientOptions } from "./b2matchClient.ts";
import { requirePublishableMeet } from "./dryRunSummary.ts";

export interface SyncDatabase {
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export function parseDispatch(value: unknown): { generation: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_dispatch");
  const generation = (value as Record<string, unknown>).generation;
  if (!Number.isSafeInteger(generation) || Number(generation) < 0) throw new Error("invalid_dispatch");
  return { generation: Number(generation) };
}

/** Every request attempts each API page once. The database fences stopped generations. */
export async function runMeetSync(database: SyncDatabase, options: B2matchClientOptions & { generation: number }): Promise<Response> {
  // Require the dispatch generation even for internal callers; unversioned work is never claimed.
  const { generation } = parseDispatch(options);
  const runId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const claim = await database.rpc("claim_meet_sync", {
    p_event_id: 17135, p_run_id: runId, p_token: token, p_generation: generation,
  });
  if (claim.error) return Response.json({ status: "unavailable" }, { status: 503 });
  if (claim.data !== true) return Response.json({ status: "not_due_or_stopped" });
  let pagesProcessed = 0;
  let recordsProcessed = 0;
  try {
    const result = await fetchAllParticipantsWithStats(options);
    pagesProcessed = result.pagesProcessed;
    recordsProcessed = result.recordsProcessed;
    const counts = requirePublishableMeet(result.participants, "17135");
    const publication = await database.rpc("complete_meet_sync", {
      p_run_id: runId, p_token: token, p_registered: counts.registered,
      p_checked_in: counts.checkedIn, p_pages: pagesProcessed, p_records: recordsProcessed,
    });
    if (publication.error || publication.data !== true) throw new B2matchSyncError("publication_failed");
    return Response.json({ status: "complete", pagesProcessed, recordsProcessed });
  } catch (error) {
    const known = error instanceof B2matchSyncError ? error : null;
    // Only classifications and numeric progress leave the worker, never API response text.
    const failure = await database.rpc("fail_meet_sync", {
      p_run_id: runId, p_token: token, p_error: known?.code ?? "unknown",
      p_pages: Math.max(known?.pagesProcessed ?? 0, pagesProcessed),
      p_records: Math.max(known?.recordsProcessed ?? 0, recordsProcessed),
      p_http_status: known?.httpStatus ?? null,
    });
    return Response.json({ status: failure.error ? "failure_unconfirmed" : "failed" },
      { status: failure.error ? 503 : 502 });
  }
}

/** Hash before comparing so header length and prefix do not affect comparison work. */
export async function workerAuthorized(request: Request, expected: string | undefined): Promise<boolean> {
  const supplied = request.headers.get("x-b2match-worker-secret");
  if (!expected || expected.length < 32 || !supplied || supplied.length > 512) return false;
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index++) difference |= actualBytes[index] ^ expectedBytes[index];
  return difference === 0;
}
