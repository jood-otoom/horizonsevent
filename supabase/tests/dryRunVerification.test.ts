import { describe, expect, it, vi } from "vitest";
import { B2matchSyncError } from "../functions/_shared/b2matchClient.ts";
import { safeDryRunFailure, verifyB2matchReadOnly } from "../functions/_shared/dryRunVerification.ts";
import { handleNamedSecretRequest, hasNamedSecretKey } from "../functions/_shared/namedSecretAuth.ts";

const checkIn = (locationId: number | string = 17135, locationType = "event") => ({
  type: "check_in", at: "2026-10-13T10:00:00Z", locationType, locationId,
});
const participant = (id: number, status = "registered", checkIns: unknown[] = []) => ({
  id, eventId: 17135, status, checkIns,
});
const page = (participants: unknown[], totalItems: number, token: string | null, currentPage: string) => ({
  participants,
  pagination: { totalItems, pageItems: participants.length, currentPage, nextPageToken: token, previousPageToken: null },
});

describe("read-only b2match verification", () => {
  it("reports only complete aggregate counts and request volume after all pages", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const second = new URL(String(input)).searchParams.get("page") === "opaque-next";
      const body = second
        ? page([participant(1, "registered", [checkIn(), checkIn()]), participant(2, "canceled", [checkIn()])], 3, null, "page-2")
        : page([participant(1, "registered", [checkIn(), checkIn()])], 3, "opaque-next", "page-1");
      return Response.json(body);
    });
    let elapsed = 0;
    const result = await verifyB2matchReadOnly(
      { apiKey: "fixture-only", eventId: "17135", fetcher },
      () => (elapsed += 42),
    );
    expect(result).toEqual({
      status: "complete", portalVerification: "pending", eventId: "17135", registered: 1, checkedIn: 1, checkInRate: 100,
      pagesProcessed: 2, recordsProcessed: 3, uniqueParticipants: 2, requestsMade: 2, durationMs: 42,
      diagnostics: { canceledParticipants: 1, unexpectedStatusParticipants: 0,
        otherEventEntranceCheckIns: 0, agendaLocationCheckIns: 0 },
    });
    expect(JSON.stringify(result)).not.toContain("fixture-only");
    expect(JSON.stringify(result)).not.toContain("checkIns");
  });

  it("withholds counts for unexpected statuses and flags unrelated event entrances", async () => {
    const fetcher: typeof fetch = async () => Response.json(page([
      participant(1, "invited", [checkIn()]),
      participant(2, "registered", [checkIn(99999), checkIn(88, "location")]),
    ], 2, null, "page-1"));
    const result = await verifyB2matchReadOnly({ apiKey: "fixture-only", eventId: "17135", fetcher });
    expect(result.status).toBe("needs_review");
    expect(result.registered).toBeNull();
    expect(result.checkedIn).toBeNull();
    expect(result.diagnostics).toEqual({ canceledParticipants: 0, unexpectedStatusParticipants: 1,
      otherEventEntranceCheckIns: 1, agendaLocationCheckIns: 1 });
    expect(JSON.stringify(result)).not.toContain("invited");
    expect(JSON.stringify(result)).not.toContain("99999");
  });

  it("withholds counts when a registered participant has a different event-entrance ID", async () => {
    const fetcher: typeof fetch = async () => Response.json(page([
      participant(1, "registered", [checkIn(99999)]),
    ], 1, null, "page-1"));
    const result = await verifyB2matchReadOnly({ apiKey: "fixture-only", eventId: "17135", fetcher });
    expect(result.status).toBe("needs_review");
    expect(result.registered).toBeNull();
    expect(result.checkedIn).toBeNull();
    expect(result.diagnostics.otherEventEntranceCheckIns).toBe(1);
  });

  it("never returns a partial result after a later page fails", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return calls === 1
        ? Response.json(page([participant(1)], 2, "next", "page-1"))
        : new Response(null, { status: 500 });
    };
    await expect(verifyB2matchReadOnly({ apiKey: "fixture-only", eventId: "17135", fetcher,
      sleep: async () => {} })).rejects.toMatchObject({ code: "transient_upstream_failure", pagesProcessed: 1,
        recordsProcessed: 1, requestsMade: 4 });
  });

  it("reports an allowlisted failure class and attempt count without partial KPIs", () => {
    const failure = new B2matchSyncError("transient_upstream_failure");
    failure.pagesProcessed = 1;
    failure.recordsProcessed = 50;
    failure.requestsMade = 4;
    expect(safeDryRunFailure(failure, 1234.4)).toEqual({
      status: "failed", portalVerification: "pending", error: "transient_upstream_failure",
      registered: null, checkedIn: null, checkInRate: null, pagesProcessed: 1,
      recordsProcessed: 50, requestsMade: 4, durationMs: 1234,
    });
    expect(safeDryRunFailure(new B2matchSyncError("sensitive dynamic text"), 0).error).toBe("unavailable");
    expect(safeDryRunFailure(new B2matchSyncError("invalid_response", "participants[].checkIns"), 0).field)
      .toBe("participants[].checkIns");
    expect(JSON.stringify(safeDryRunFailure(new B2matchSyncError("invalid_response", "private-email@example.test"), 0)))
      .not.toContain("private-email@example.test");
    expect(safeDryRunFailure(new B2matchSyncError("invalid_response", "pagination.currentPage", "empty_string"), 0).observedKind)
      .toBe("empty_string");
    expect(JSON.stringify(safeDryRunFailure(new B2matchSyncError("invalid_response", "pagination.currentPage", "private-value"), 0)))
      .not.toContain("private-value");
  });
});

describe("named service-key boundary", () => {
  it("rejects missing and malformed named-key configuration before the handler runs", async () => {
    const handler = vi.fn(async () => Response.json({ status: "complete" }));
    expect(hasNamedSecretKey("{", "b2match_verification")).toBe(false);
    expect(hasNamedSecretKey(JSON.stringify({ automations: "test" }), "b2match_verification")).toBe(false);
    const response = await handleNamedSecretRequest(new Request("https://example.test"), "b2match_verification", "{}", handler);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("hides auth and server details from unauthorized callers", async () => {
    const request = new Request("https://example.test");
    const key = JSON.stringify({ b2match_verification: "synthetic-secret" });
    const denied = await handleNamedSecretRequest(request, "b2match_verification", key,
      async () => Response.json({ error: "secret detail" }, { status: 403 }));
    expect(await denied.json()).toEqual({ error: "unauthorized" });
    const failed = await handleNamedSecretRequest(request, "b2match_verification", key,
      async () => Response.json({ error: "upstream body" }, { status: 502 }));
    const body = await failed.json();
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain("synthetic-secret");
  });

  it("does not expose a failed handler exception", async () => {
    const response = await handleNamedSecretRequest(new Request("https://example.test"), "x", '{"x":"test"}',
      async () => { throw new B2matchSyncError("synthetic-internal-error"); });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "service_unavailable" });
  });
});
