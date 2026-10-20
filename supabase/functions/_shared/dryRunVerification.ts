import { B2matchSyncError, fetchAllParticipantsWithStats, type B2matchClientOptions } from "./b2matchClient.ts";
import { summarizeDryRun } from "./dryRunSummary.ts";

export interface DryRunResult {
  status: "complete" | "needs_review";
  portalVerification: "pending";
  eventId: string;
  registered: number | null;
  checkedIn: number | null;
  checkInRate: number | null;
  pagesProcessed: number;
  recordsProcessed: number;
  uniqueParticipants: number;
  requestsMade: number;
  durationMs: number;
  diagnostics: ReturnType<typeof summarizeDryRun>["diagnostics"];
}

const SAFE_FAILURE_CODES = new Set([
  "missing_api_key", "invalid_event_id", "invalid_response", "wrong_event",
  "upstream_redirect", "upstream_unauthorized", "event_not_found", "upstream_failure",
  "transient_upstream_failure", "invalid_json", "network_failure", "retry_after_exceeds_budget",
  "repeated_current_page", "inconsistent_pagination", "conflicting_participant",
  "incomplete_pagination", "repeated_page_token", "page_limit_exceeded", "sync_timeout",
  "unknown_participant_status",
]);

const SAFE_RESPONSE_FIELDS = new Set([
  "response", "pagination", "participants", "pagination.totalItems", "pagination.pageItems",
  "pagination.currentPage", "pagination.nextPageToken", "pagination.previousPageToken",
  "participants[]", "participants[].id", "participants[].eventId", "participants[].status",
  "participants[].checkIns", "participants[].registeredAt", "participants[].validated",
  "participants[].visible", "participants[].checkIns[]", "participants[].checkIns[].type",
  "participants[].checkIns[].locationType", "participants[].checkIns[].at",
  "participants[].checkIns[].locationId",
]);
const SAFE_VALUE_KINDS = new Set(["missing", "null", "empty_string", "string", "integer", "number", "boolean", "array", "object"]);

export function safeDryRunFailure(error: unknown, durationMs: number) {
  const known = error instanceof B2matchSyncError ? error : null;
  const field = known?.code === "invalid_response" && known.field && SAFE_RESPONSE_FIELDS.has(known.field)
    ? known.field
    : null;
  const observedKind = field && known?.observedKind && SAFE_VALUE_KINDS.has(known.observedKind)
    ? known.observedKind
    : null;
  return {
    status: "failed" as const,
    portalVerification: "pending" as const,
    error: known && SAFE_FAILURE_CODES.has(known.code) ? known.code : "unavailable",
    ...(field ? { field } : {}),
    ...(observedKind ? { observedKind } : {}),
    registered: null,
    checkedIn: null,
    checkInRate: null,
    pagesProcessed: known?.pagesProcessed ?? 0,
    recordsProcessed: known?.recordsProcessed ?? 0,
    requestsMade: known?.requestsMade ?? 0,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

export async function verifyB2matchReadOnly(
  options: B2matchClientOptions,
  clock: () => number = performance.now.bind(performance),
): Promise<DryRunResult> {
  const started = clock();
  const result = await fetchAllParticipantsWithStats(options);
  const summary = summarizeDryRun(result.participants, options.eventId);
  // Only aggregate primitives leave this function. Participant data is not logged or persisted.
  return {
    status: summary.status,
    portalVerification: "pending",
    eventId: options.eventId,
    registered: summary.counts?.registered ?? null,
    checkedIn: summary.counts?.checkedIn ?? null,
    checkInRate: summary.counts?.checkInRate ?? null,
    pagesProcessed: result.pagesProcessed,
    recordsProcessed: result.recordsProcessed,
    uniqueParticipants: result.participants.length,
    requestsMade: result.requestsMade,
    durationMs: Math.max(0, Math.round(clock() - started)),
    diagnostics: summary.diagnostics,
  };
}
