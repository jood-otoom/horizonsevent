const PARTICIPANTS_URL = "https://api.b2match.com/public/participants";
const PAGE_SIZE = 50;
const MAX_PAGES = 100;
const MAX_SYNC_MS = 120_000;
const REQUEST_TIMEOUT_MS = 12_000;

export interface Participant {
  id: string;
  eventId: string;
  status: string;
  checkIns: CheckIn[];
}

interface CheckIn {
  type: string;
  at: string;
  locationType: string;
  locationId: string;
}

interface ParticipantPage {
  participants: Participant[];
  pagination: {
    totalItems: number;
    pageItems: number;
    currentPage: string;
    nextPageToken: string | null;
  };
}

export interface B2matchClientOptions {
  apiKey: string;
  eventId: string;
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class B2matchSyncError extends Error {
  pagesProcessed = 0;
  recordsProcessed = 0;
  requestsMade = 0;
  constructor(readonly code: string, readonly field?: string, readonly observedKind?: string) {
    super(code);
  }
}

function responseValueKind(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (typeof value === "string") return value.length === 0 ? "empty_string" : "string";
  if (typeof value === "number") return Number.isSafeInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  return "object";
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new B2matchSyncError("invalid_response", field, responseValueKind(value));
  }
  return value as Record<string, unknown>;
}

function identifier(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new B2matchSyncError("invalid_response", field, responseValueKind(value));
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new B2matchSyncError("invalid_response", field, responseValueKind(value));
  }
  return value;
}

function date(value: unknown, field: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new B2matchSyncError("invalid_response", field, responseValueKind(value));
  }
  return value;
}

export function parseParticipantPage(value: unknown, eventId: string): ParticipantPage {
  const body = record(value, "response");
  const pagination = record(body.pagination, "pagination");
  if (!Array.isArray(body.participants)) throw new B2matchSyncError("invalid_response", "participants", responseValueKind(body.participants));
  const totalItems = integer(pagination.totalItems, "pagination.totalItems");
  const pageItems = integer(pagination.pageItems, "pagination.pageItems");
  const currentPage = pagination.currentPage;
  const token = pagination.nextPageToken;
  const previousToken = pagination.previousPageToken;
  if (pageItems !== body.participants.length) throw new B2matchSyncError("invalid_response", "pagination.pageItems");
  if (typeof currentPage !== "string") {
    throw new B2matchSyncError("invalid_response", "pagination.currentPage", responseValueKind(currentPage));
  }
  if (token !== null && typeof token !== "string") throw new B2matchSyncError("invalid_response", "pagination.nextPageToken", responseValueKind(token));
  if (previousToken !== null && typeof previousToken !== "string") throw new B2matchSyncError("invalid_response", "pagination.previousPageToken", responseValueKind(previousToken));

  const participants = body.participants.map((raw) => {
    const item = record(raw, "participants[]");
    const id = identifier(item.id, "participants[].id");
    if (identifier(item.eventId, "participants[].eventId") !== eventId) throw new B2matchSyncError("wrong_event");
    if (typeof item.status !== "string" || !item.status.trim()) {
      throw new B2matchSyncError("invalid_response", "participants[].status", responseValueKind(item.status));
    }
    if (!Array.isArray(item.checkIns)) throw new B2matchSyncError("invalid_response", "participants[].checkIns", responseValueKind(item.checkIns));
    if (item.registeredAt !== undefined && item.registeredAt !== null) date(item.registeredAt, "participants[].registeredAt");
    if (item.validated !== undefined && item.validated !== null && typeof item.validated !== "boolean") {
      throw new B2matchSyncError("invalid_response", "participants[].validated", responseValueKind(item.validated));
    }
    if (item.visible !== undefined && item.visible !== null && typeof item.visible !== "boolean") {
      throw new B2matchSyncError("invalid_response", "participants[].visible", responseValueKind(item.visible));
    }
    const checkIns = item.checkIns.map((rawCheckIn: unknown) => {
      const checkIn = record(rawCheckIn, "participants[].checkIns[]");
      if (checkIn.type !== "check_in" && checkIn.type !== "check_out") {
        throw new B2matchSyncError("invalid_response", "participants[].checkIns[].type", responseValueKind(checkIn.type));
      }
      if (checkIn.locationType !== "event" && checkIn.locationType !== "location") {
        throw new B2matchSyncError("invalid_response", "participants[].checkIns[].locationType", responseValueKind(checkIn.locationType));
      }
      return {
        type: checkIn.type,
        at: date(checkIn.at, "participants[].checkIns[].at"),
        locationType: checkIn.locationType,
        locationId: identifier(checkIn.locationId, "participants[].checkIns[].locationId"),
      };
    });
    return { id, eventId, status: item.status, checkIns };
  });
  return { participants, pagination: { totalItems, pageItems, currentPage, nextPageToken: token || null } };
}

function retryDelay(response: Response | null, attempt: number): number {
  const header = response?.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    const until = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(until)) return Math.max(0, until);
  }
  return Math.min(10_000, 250 * 2 ** attempt + Math.random() * 250);
}

export async function fetchAllParticipantsWithStats(options: B2matchClientOptions): Promise<{
  participants: Participant[];
  pagesProcessed: number;
  recordsProcessed: number;
  requestsMade: number;
}> {
  if (!options.apiKey) throw new B2matchSyncError("missing_api_key");
  if (!/^\d+$/.test(options.eventId)) throw new B2matchSyncError("invalid_event_id");
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + MAX_SYNC_MS;
  const seenTokens = new Set<string>();
  const seenPages = new Set<string>();
  const participants = new Map<string, Participant>();
  let nextToken: string | null = null;
  let total: number | null = null;
  let rawCount = 0;
  let completedPages = 0;
  let requestsMade = 0;

  try {
  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    if (now() >= deadline) throw new B2matchSyncError("sync_timeout");
    const url = new URL(PARTICIPANTS_URL);
    url.searchParams.set("event_id", options.eventId);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (nextToken) url.searchParams.set("page", nextToken);

    let page: ParticipantPage | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, Math.max(1, deadline - now())));
      let response: Response | null = null;
      try {
        requestsMade++;
        response = await fetcher(url.toString(), {
          method: "GET",
          headers: { authorization: `Bearer ${options.apiKey}`, accept: "application/json" },
          redirect: "manual",
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) throw new B2matchSyncError("upstream_redirect");
        if (response.status === 401 || response.status === 403) throw new B2matchSyncError("upstream_unauthorized");
        if (response.status === 404) throw new B2matchSyncError("event_not_found");
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500) throw new B2matchSyncError("upstream_failure");
          throw new B2matchSyncError("transient_upstream_failure");
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new B2matchSyncError("invalid_json");
        }
        page = parseParticipantPage(body, options.eventId);
        break;
      } catch (error) {
        const code = error instanceof B2matchSyncError ? error.code : "network_failure";
        if (code !== "network_failure" && code !== "transient_upstream_failure") throw error;
        if (attempt === 2 || now() >= deadline) throw new B2matchSyncError(code);
        const delay = retryDelay(response, attempt);
        if (now() + delay >= deadline) throw new B2matchSyncError("retry_after_exceeds_budget");
        await sleep(delay);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!page) throw new B2matchSyncError("upstream_failure");
    // The live API uses an empty string on its first page; opaque next-page tokens
    // remain the authoritative loop guard when no current-page identifier is supplied.
    if (page.pagination.currentPage) {
      if (seenPages.has(page.pagination.currentPage)) throw new B2matchSyncError("repeated_current_page");
      seenPages.add(page.pagination.currentPage);
    }
    if (total !== null && total !== page.pagination.totalItems) throw new B2matchSyncError("inconsistent_pagination");
    total = page.pagination.totalItems;
    rawCount += page.pagination.pageItems;
    if (rawCount > total || (page.participants.length === 0 && page.pagination.nextPageToken)) {
      throw new B2matchSyncError("inconsistent_pagination");
    }
    for (const participant of page.participants) {
      const existing = participants.get(participant.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(participant)) {
        throw new B2matchSyncError("conflicting_participant");
      }
      participants.set(participant.id, participant);
    }
    completedPages = pageNumber;
    nextToken = page.pagination.nextPageToken;
    if (!nextToken) {
      if (rawCount !== total) throw new B2matchSyncError("incomplete_pagination");
      return { participants: [...participants.values()], pagesProcessed: pageNumber, recordsProcessed: rawCount, requestsMade };
    }
    if (seenTokens.has(nextToken)) throw new B2matchSyncError("repeated_page_token");
    seenTokens.add(nextToken);
  }
  throw new B2matchSyncError("page_limit_exceeded");
  } catch (error) {
    if (error instanceof B2matchSyncError) {
      error.pagesProcessed = completedPages;
      error.recordsProcessed = rawCount;
      error.requestsMade = requestsMade;
    }
    throw error;
  }
}

