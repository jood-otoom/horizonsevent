# Backend API contracts

All functions live under the Supabase Functions URL `/functions/v1/<name>`. The platform's `verify_jwt=true` check applies to `dashboard-data` and `controller-submit`; `@supabase/server` then verifies the user JWT and supplies an RLS-scoped client. The service-only `sync-b2match` and deployed, disabled-by-default `verify-b2match` use named secret keys on `apikey`; both have `verify_jwt=false` and enforce their named key in the server wrapper. Browser origins must match `DASHBOARD_ALLOWED_ORIGINS` exactly. CORS is an extra browser boundary, not a substitute for Auth. Responses use `Cache-Control: no-store` where the browser calls them. Event ID 17135 is fixed server-side.

## `GET dashboard-data`

Requires a signed-in `viewer`, `staff`, or `admin` event member. A failed membership lookup returns a generic 503. It reads the RLS-scoped `dashboard_aggregates` and `event_settings` rows and returns only:

```json
{
  "eventId": 17135,
  "meet": {
    "registered": 10,
    "checkedIn": 7,
    "checkInRate": 70,
    "lastSuccessfulSync": "2026-10-10T10:00:00Z",
    "verification": "pending",
    "status": "pending"
  },
  "match": { "completedMeetings": 3, "targetMeetings": null },
  "grow": { "feedbackCount": 2, "averageRating": 4.5 }
}
```

Numbers and timestamp above are synthetic contract examples. Before the first MEET publication, `meet` is `null`, never a fabricated zero. MEET `live` requires a fresh successful automatic sync and the owner-approved portal-verification flag; a failed or aged synced snapshot returns `stale`. While `B2MATCH_SYNC_ENABLED` is off, an approved one-time publication instead returns `status: "snapshot"`, `verification: "approved"`, and `publishedAt` in place of `lastSuccessfulSync`. For event 17135 this currently carries 202 registered, 0 checked in, and 0%; the canceled participant is excluded and is not exposed. `publishedAt` is the database publication time, not a new b2match fetch time. A null meeting target means owner approval is pending. The response contains no participant or staff records.

## `POST controller-submit`

Requires a signed-in `staff` or `admin` event member. A failed membership lookup returns a generic 503. JSON body is either `{ "eventId": 17135, "kind": "meeting", "requestId": "<UUID>", "quantity": 1|2|3 }` or `{ "eventId": 17135, "kind": "feedback", "requestId": "<UUID>", "rating": 1..5 }`. A request ID may be retried with the same kind and payload; conflicting reuse returns 409. One meeting record is stored per meeting, including a +2 or +3 submission. Feedback stores each rating. The response includes a minimal `record` (`id`, `createdAt`, optional `rating`) and authoritative `stats` (`completedMeetings`, `feedbackCount`, `averageRating`). Database constraints and service-only transactional functions enforce idempotency and aggregate updates.

The deployed correction contract accepts `{ "eventId": 17135, "kind": "undo", "requestId": "<new UUID>", "originalRequestId": "<prior submission UUID>", "reason": "duplicate"|"wrong_count"|"wrong_rating"|"other" }`. It reverses the **entire** chosen submission, never an arbitrary numeric total. The same correction request can be retried; a second correction for the original returns 409. Success returns `reversal` (`id`, `originalRequestId`, `createdAt`) and authoritative `stats`. Normal corrections retain original meeting/feedback records; `controller_reversals` records actor, reason, and time. The hosted Controller reversed two synthetic meeting actions before the separately approved fixture cleanup.

## `GET controller-submit` — staff history

After the same staff/admin Auth and membership checks, returns `{ "actions": [...] }` with the 12 most recent original submissions. Each action contains request ID, kind, quantity or rating, creation time, and nullable reversal time. It exposes no staff identity or participant data. The browser has no direct read grant on the source or audit tables. The deployed route loaded and refreshed history in the authorized Safari rehearsal.

## `POST sync-b2match`

Requires the named Supabase secret API key `automations` in the `apikey` header. No browser route or user JWT can invoke it. If the named key is absent, it returns a generic 401 before the SDK can expose configuration diagnostics. It also requires `B2MATCH_SYNC_ENABLED=true`, `B2MATCH_EVENT_ID=17135`, and a server-side `B2MATCH_API_KEY`. It claims a database lease, fetches all pages, validates and aggregates, and calls one transactional publication function. A concurrent run returns 409; disabled or unavailable service state returns a generic 503; a failed pull returns a generic 502 and leaves prior counts intact. Success returns safe page and record counts only. There is no scheduled job in this repository.

## `POST verify-b2match` — deployed, dry-run gate disabled

Requires a separate named Supabase secret API key `b2match_verification` in `apikey`, `B2MATCH_DRY_RUN_ENABLED=true`, `B2MATCH_EVENT_ID=17135`, and the server-side `B2MATCH_API_KEY`. Browser CORS is disabled. It calls only the fixed b2match participants API and never calls Supabase database APIs. On a complete traversal it returns `status`, `portalVerification: "pending"`, `eventId`, `registered`, `checkedIn`, `checkInRate`, `pagesProcessed`, `recordsProcessed`, `uniqueParticipants`, `requestsMade` (including retries), `durationMs`, and integer diagnostics for canceled records, unexpected statuses, other event-entrance scans, and agenda-location scans. `status: "complete"` means the API traversal completed, not that portal totals agree. Unexpected statuses or other event-entrance scans make all KPI values null and set `needs_review`. It returns no participant IDs, status strings, check-in history, or credential. A failed pull returns HTTP 424 with an allowlisted `error` class, optional static `field`/`observedKind` labels, request/page/record counts, duration, and null KPIs; arbitrary server errors remain generic. The fifth owner-approved attempt completed all five pages after correcting the overly strict empty-current-page check. It returned 202 registered, 0 checked in, and `portalVerification: "pending"`; the gate was reset off. The publishing `sync-b2match` deployment was not changed.

## Errors and source labeling

Function errors expose short classifications, never upstream response bodies, keys, raw participants, or database internals. The frontend validates aggregate responses again. Demo mode calls none of these functions. In live mode a failed first read shows unavailable values; a failed later read retains prior values with stale labels. Realtime carries only the aggregate table's rows and triggers an authoritative refetch.
