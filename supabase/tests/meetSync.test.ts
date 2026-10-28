import { describe, expect, it, vi } from "vitest";
import { parseDispatch, runMeetSync, workerAuthorized, type SyncDatabase } from "../functions/_shared/meetSync.ts";

const apiPage = (id = 1, nextPageToken: string | null = null, totalItems = 1) => ({
  participants: [{ id, eventId: 17135, status: "registered", checkIns: [] }],
  pagination: { totalItems, pageItems: 1, currentPage: `page-${id}`, nextPageToken, previousPageToken: null },
});
const options = (fetcher: typeof fetch) => ({ apiKey: "synthetic-only", eventId: "17135", generation: 3, fetcher });

function database({ claim = true, publish = true, publicationError = false } = {}) {
  const rpc = vi.fn<SyncDatabase["rpc"]>(async (name) => ({
    data: name === "claim_meet_sync" ? claim : name === "complete_meet_sync" ? publish : true,
    error: name === "complete_meet_sync" && publicationError ? { message: "private database details" } : null,
  }));
  return { rpc };
}

describe("single-attempt fenced synchronization", () => {
  it("rejects absent, negative, fractional or unsafe dispatch generations", () => {
    for (const value of [{}, { generation: null }, { generation: -1 }, { generation: 0.5 },
      { generation: "3" }, { generation: Number.MAX_SAFE_INTEGER + 1 }, null]) {
      expect(() => parseDispatch(value)).toThrow("invalid_dispatch");
    }
    expect(parseDispatch({ generation: 0 })).toEqual({ generation: 0 });
  });

  it("passes stale dispatch generations unchanged so the database can deny them before fetching", async () => {
    const rpc = vi.fn<SyncDatabase["rpc"]>(async (_name, parameters) => ({
      data: parameters.p_generation === 4, error: null,
    }));
    const fetcher = vi.fn<typeof fetch>();
    const response = await runMeetSync({ rpc }, options(fetcher));
    expect(await response.json()).toEqual({ status: "not_due_or_stopped" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_generation: 3 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fetches immediately after a successful claim and publishes only complete counts", async () => {
    const db = database();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(apiPage()));
    const response = await runMeetSync(db, options(fetcher));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "complete", pagesProcessed: 1, recordsProcessed: 1 });
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_meet_sync", "complete_meet_sync"]);
    expect(db.rpc.mock.calls[1][1]).toMatchObject({ p_registered: 1, p_checked_in: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when stopped, in manual mode, not due, or another worker holds the lease", async () => {
    const db = database({ claim: false });
    const fetcher = vi.fn<typeof fetch>();
    expect((await runMeetSync(db, options(fetcher))).status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, 401, 403])("persists HTTP %i and failure once without publishing", async (status) => {
    const db = database();
    const fetcher = vi.fn<typeof fetch>(async () => new Response("sensitive body", { status }));
    const response = await runMeetSync(db, options(fetcher));
    expect(response.status).toBe(502);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_meet_sync", "fail_meet_sync"]);
    expect(db.rpc.mock.calls[1][1]).toMatchObject({ p_http_status: status, p_pages: 0, p_records: 0 });
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain("sensitive body");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never publishes partial pagination or invalid JSON", async () => {
    for (const result of [Response.json(apiPage(1, null, 2)), new Response("not json")]) {
      const db = database();
      const response = await runMeetSync(db, options(async () => result));
      expect(response.status).toBe(502);
      expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_meet_sync", "fail_meet_sync"]);
      expect(db.rpc.mock.calls[1][1]).toMatchObject({ p_http_status: 200 });
    }
  });

  it("treats database publication errors and generation fencing as failed publication", async () => {
    for (const db of [database({ publish: false }), database({ publicationError: true })]) {
      expect((await runMeetSync(db, options(async () => Response.json(apiPage())))).status).toBe(502);
      expect(db.rpc.mock.calls[2]).toEqual(["fail_meet_sync", expect.objectContaining({ p_error: "publication_failed", p_pages: 1, p_records: 1 })]);
    }
  });

  it("reports an unconfirmed failure if the database cannot persist its failed state", async () => {
    const db: SyncDatabase = { rpc: async (name) => name === "claim_meet_sync"
      ? { data: true, error: null } : { data: null, error: { message: "private" } } };
    const response = await runMeetSync(db, options(async () => { throw new Error("private network details"); }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "failure_unconfirmed" });
  });

  it("validates a dedicated worker secret without accepting browser API credentials", async () => {
    const secret = "synthetic-worker-secret-for-testing-only-123456";
    expect(await workerAuthorized(new Request("https://example.test", { headers: { "x-b2match-worker-secret": secret } }), secret)).toBe(true);
    expect(await workerAuthorized(new Request("https://example.test", { headers: { apikey: secret } }), secret)).toBe(false);
    expect(await workerAuthorized(new Request("https://example.test", { headers: { "x-b2match-worker-secret": `${secret}wrong` } }), secret)).toBe(false);
    expect(await workerAuthorized(new Request("https://example.test"), undefined)).toBe(false);
  });
});
