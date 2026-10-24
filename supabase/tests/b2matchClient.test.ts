import { describe, expect, it, vi } from "vitest";
import { fetchAllParticipantsWithStats, parseParticipantPage, type B2matchClientOptions } from "../functions/_shared/b2matchClient.ts";
import { aggregateMeet } from "../functions/_shared/meetAggregation.ts";

const participant = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  eventId: 17135,
  status: "registered",
  registeredAt: "2026-10-01T00:00:00Z",
  validated: false,
  visible: false,
  checkIns: [],
  ...overrides,
});

const page = (participants: unknown[], totalItems = participants.length, nextPageToken: string | null = null, currentPage = 1) => ({
  participants,
  pagination: { totalItems, pageItems: participants.length, currentPage: `page-${currentPage}`, nextPageToken, previousPageToken: null },
});

const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

const options = (fetcher: typeof fetch) => ({ apiKey: "synthetic-test-key", eventId: "17135", fetcher, sleep: async () => {} });
const fetchAllParticipants = async (settings: B2matchClientOptions) =>
  (await fetchAllParticipantsWithStats(settings)).participants;

describe("b2match participant client", () => {
  it("sends Bearer authorization only to the fixed HTTPS host and reads one page", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.b2match.com");
      expect(url.pathname).toBe("/public/participants");
      expect(url.searchParams.get("event_id")).toBe("17135");
      expect(url.searchParams.get("limit")).toBe("50");
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-test-key");
      return response(page([participant(1)]));
    });
    expect(await fetchAllParticipants(options(fetcher))).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns an empty event only when pagination confirms zero", async () => {
    expect(await fetchAllParticipants(options(async () => response(page([]))))).toEqual([]);
  });

  it("requires documented string current page and explicit pagination tokens", () => {
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, currentPage: 0 } }, "17135")).toThrow();
    const missingToken = { ...page([]), pagination: { ...page([]).pagination, nextPageToken: undefined } };
    expect(() => parseParticipantPage(missingToken, "17135")).toThrow();
    expect(parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, currentPage: "" } }, "17135")
      .pagination.currentPage).toBe("");
    expect(parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, nextPageToken: "" } }, "17135")
      .pagination.nextPageToken).toBe("");
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, nextPageToken: "  " } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.nextPageToken" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, totalItems: undefined } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.totalItems" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, pageItems: 1 } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.pageItems" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, nextPageToken: 4 } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.nextPageToken" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: undefined }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination" }));
    expect(() => parseParticipantPage(page(Array.from({ length: 51 }, (_, index) => participant(index))), "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.pageItems" }));
  });

  it("labels malformed fields without attaching participant values", () => {
    expect(() => parseParticipantPage(page([participant(1, { checkIns: undefined })]), "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "participants[].checkIns", observedKind: "missing" }));
    expect(() => parseParticipantPage(page([participant(1, { id: " 1 " })]), "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "participants[].id" }));
    expect(() => parseParticipantPage(page([participant(1, { checkIns: [{ type: "check_in" }] })]), "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "participants[].checkIns[].locationType", observedKind: "missing" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, currentPage: null } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.currentPage", observedKind: "null" }));
    expect(() => parseParticipantPage({ ...page([]), pagination: { ...page([]).pagination, currentPage: 1 } }, "17135"))
      .toThrowError(expect.objectContaining({ code: "invalid_response", field: "pagination.currentPage", observedKind: "integer" }));
  });

  it("follows opaque tokens and deduplicates identical participant IDs", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      new URL(String(input)).searchParams.has("page")
        ? response(page([participant(1), participant(2)], 3, null, 2))
        : response(page([participant(1)], 3, "opaque-token")));
    const records = await fetchAllParticipants(options(fetcher));
    expect(records.map((item) => item.id)).toEqual(["1", "2"]);
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("page")).toBe("opaque-token");
  });

  it("allows an empty current-page label while opaque tokens still advance pagination", async () => {
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      calls++;
      return calls === 1
        ? response({ ...page([participant(1)], 2, "next"), pagination: { ...page([participant(1)], 2, "next").pagination, currentPage: "" } })
        : response({ ...page([participant(2)], 2, null, 2), pagination: { ...page([participant(2)], 2, null, 2).pagination, currentPage: "" } });
    });
    expect((await fetchAllParticipants(options(fetcher))).map((item) => item.id)).toEqual(["1", "2"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("accepts a short final page with an empty token only after all expected unique records", async () => {
    const pages = Array.from({ length: 5 }, (_, index) => {
      const count = index === 4 ? 44 : 50;
      const records = Array.from({ length: count }, (_, offset) => participant(index * 50 + offset + 1));
      const body = page(records, 244, index === 4 ? "" : `token-${index + 1}`, index + 1);
      return index === 0 ? { ...body, pagination: { ...body.pagination, currentPage: "" } } : body;
    });
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const token = new URL(String(input)).searchParams.get("page");
      const index = token === null ? 0 : Number(token.slice("token-".length));
      return response(pages[index]);
    });
    const result = await fetchAllParticipantsWithStats(options(fetcher));
    expect(result).toMatchObject({ pagesProcessed: 5, recordsProcessed: 244, requestsMade: 5 });
    expect(result.participants).toHaveLength(244);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("rejects an empty token before the reported total is reached", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => response(
      new URL(String(input)).searchParams.has("page")
        ? page([participant(2)], 3, "", 2)
        : page([participant(1)], 3, "next"),
    ));
    await expect(fetchAllParticipantsWithStats(options(fetcher)))
      .rejects.toMatchObject({ code: "incomplete_pagination", pagesProcessed: 2, recordsProcessed: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty token on a full page even when the reported total is reached", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response(page(
      Array.from({ length: 50 }, (_, index) => participant(index + 1)), 50, "",
    )));
    await expect(fetchAllParticipantsWithStats(options(fetcher)))
      .rejects.toMatchObject({ code: "incomplete_pagination", pagesProcessed: 1, recordsProcessed: 50 });
  });

  it("continues to accept a null terminal token with a consistent total", async () => {
    const result = await fetchAllParticipantsWithStats(options(async () => response(page([participant(1)], 1, null))));
    expect(result).toMatchObject({ pagesProcessed: 1, recordsProcessed: 1 });
    expect(result.participants.map((item) => item.id)).toEqual(["1"]);
  });

  it("rejects a changed total and does not let duplicate IDs justify an empty terminal token", async () => {
    const changedTotal = vi.fn<typeof fetch>(async (input) => response(
      new URL(String(input)).searchParams.has("page")
        ? page([participant(2)], 3, "", 2)
        : page([participant(1)], 2, "next"),
    ));
    await expect(fetchAllParticipantsWithStats(options(changedTotal)))
      .rejects.toMatchObject({ code: "inconsistent_pagination" });
    const repeatedId = vi.fn<typeof fetch>(async (input) => response(
      new URL(String(input)).searchParams.has("page")
        ? page([participant(1)], 2, "", 2)
        : page([participant(1)], 2, "next"),
    ));
    await expect(fetchAllParticipantsWithStats(options(repeatedId)))
      .rejects.toMatchObject({ code: "incomplete_pagination" });
  });

  it.each([
    ["missing final token", [page([participant(1)], 2)]],
    ["repeated token", [page([participant(1)], 3, "repeat"), page([participant(2)], 3, "repeat", 2)]],
    ["empty intermediate page", [page([], 1, "next")]],
    ["wrong event", [page([participant(1, { eventId: 999 })])]],
    ["conflicting duplicate", [page([participant(1)], 2, "next"), page([participant(1, { status: "canceled" })], 2, null, 2)]],
  ])("rejects %s without returning partial counts", async (_name, pages) => {
    let index = 0;
    const fetcher: typeof fetch = async () => response(pages[Math.min(index++, pages.length - 1)]);
    await expect(fetchAllParticipants(options(fetcher))).rejects.toThrow();
  });

  it("does not retry missing or invalid credentials", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({}, 401));
    await expect(fetchAllParticipants({ ...options(fetcher), apiKey: "" })).rejects.toThrow("missing_api_key");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(fetchAllParticipants(options(fetcher))).rejects.toThrow("upstream_unauthorized");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const forbidden = vi.fn<typeof fetch>(async () => response({}, 403));
    await expect(fetchAllParticipants(options(forbidden))).rejects.toThrow("upstream_unauthorized");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects, invalid JSON, malformed fields, and partial network failures", async () => {
    await expect(fetchAllParticipants(options(async () => new Response(null, { status: 302, headers: { location: "https://elsewhere.test" } })))).rejects.toThrow("upstream_redirect");
    await expect(fetchAllParticipants(options(async () => new Response("not JSON")))).rejects.toThrow("invalid_json");
    expect(() => parseParticipantPage(page([participant(1, { checkIns: undefined })]), "17135")).toThrow();
    expect(() => parseParticipantPage(page([participant(1, { checkIns: [{ type: "check_in" }] })]), "17135")).toThrow();
    let count = 0;
    await expect(fetchAllParticipants(options(async () => {
      count++;
      return count === 1 ? response(page([participant(1)], 2, "next")) : response({}, 500);
    }))).rejects.toThrow("transient_upstream_failure");
  });

  it("bounds retries for 429 responses and request timeouts", async () => {
    const throttled = vi.fn<typeof fetch>(async () => response({}, 429, { "retry-after": "0" }));
    await expect(fetchAllParticipants(options(throttled))).rejects.toThrow("transient_upstream_failure");
    expect(throttled).toHaveBeenCalledTimes(3);
    const serverError = vi.fn<typeof fetch>(async () => response({}, 503));
    await expect(fetchAllParticipants(options(serverError))).rejects.toThrow("transient_upstream_failure");
    expect(serverError).toHaveBeenCalledTimes(3);
    const excessiveDelay = vi.fn<typeof fetch>(async () => response({}, 429, { "retry-after": "121" }));
    await expect(fetchAllParticipants(options(excessiveDelay))).rejects.toThrow("retry_after_exceeds_budget");
    expect(excessiveDelay).toHaveBeenCalledTimes(1);
  });

  it("aborts and retries a hung request only three times", async () => {
    vi.useFakeTimers();
    try {
      const aborting = vi.fn<typeof fetch>(async (_input, init) => {
        await new Promise<void>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
        throw new Error("unreachable");
      });
      const pending = fetchAllParticipants(options(aborting));
      const rejected = expect(pending).rejects.toThrow("network_failure");
      await vi.advanceTimersByTimeAsync(36_000);
      await rejected;
      expect(aborting).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts every upstream attempt including successful retries", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return calls === 1 ? response({}, 429, { "retry-after": "0" }) : response(page([participant(1)]));
    };
    const result = await fetchAllParticipantsWithStats(options(fetcher));
    expect(result.requestsMade).toBe(2);
    expect(result.pagesProcessed).toBe(1);
  });
});

describe("MEET aggregation", () => {
  const checkedIn = { type: "check_in", at: "2026-10-10T10:00:00Z", locationType: "event", locationId: "17135" };

  it("counts unvalidated and hidden registrations and unique event-entrance attendees", () => {
    const records = parseParticipantPage(page([
      participant(1, { checkIns: [checkedIn, checkedIn, { ...checkedIn, type: "check_out" }] }),
      participant(2, { checkIns: [{ ...checkedIn, locationType: "location", locationId: "94" }] }),
      participant(3, { checkIns: [{ ...checkedIn, locationId: "other" }] }),
      participant(4, { status: "canceled", checkIns: [checkedIn] }),
    ]), "17135").participants;
    expect(aggregateMeet(records)).toEqual({ registered: 3, checkedIn: 1, checkInRate: 33 });
  });

  it("does not count check-out alone or unrelated location types", () => {
    const records = parseParticipantPage(page([
      participant(1, { checkIns: [{ ...checkedIn, type: "check_out" }] }),
      participant(2, { checkIns: [{ ...checkedIn, locationType: "location" }] }),
    ]), "17135").participants;
    expect(aggregateMeet(records)).toEqual({ registered: 2, checkedIn: 0, checkInRate: 0 });
  });

  it("rejects unexpected status values", () => {
    expect(() => aggregateMeet([{ id: "1", eventId: "17135", status: "unknown", checkIns: [] }])).toThrow("unknown_participant_status");
  });

  it("never counts a repeated participant ID twice", () => {
    const records = parseParticipantPage(page([participant(1, { checkIns: [checkedIn] })]), "17135").participants;
    expect(aggregateMeet([...records, ...records])).toEqual({ registered: 1, checkedIn: 1, checkInRate: 100 });
  });
});
