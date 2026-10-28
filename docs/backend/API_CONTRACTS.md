# Backend API contracts

Event `17135` is fixed on the server. Browser functions use the existing Supabase user JWT, `event_memberships` authorization, and exact `DASHBOARD_ALLOWED_ORIGINS` allowlist. Public dashboard reads need no login. CORS supplements authorization; it is not an access-control substitute. Responses use `Cache-Control: no-store` through the origin wrapper. Private tokens and privileged database credentials never enter the frontend.

The October 28 function source is deployed to project `kkiambvltxuieuncwtfz`. Read-only plugin downloads matched every returned source/configuration file against the local release for `controller-submit` v25, `dashboard-data` v25, `public-dashboard-data` v5, `sync-b2match` v28, and `verify-b2match` v30. JWT settings match the contracts below. Read-only SQL confirmed the three event-control migrations, enabled scheduler extensions/job, Stopped API mode, and zero runs/leases. This verifies hosted source/configuration, not a live B2Match pull or every production behavior. See [deployment status](../deployment/DEPLOYMENT.md) for bundle hashes, frontend verification, and outstanding checks.

## Dashboard reads

`GET public-dashboard-data` is anonymous and returns only fixed-event aggregates. Other methods return 405. `GET dashboard-data` retains the same payload for authenticated `viewer`, `staff`, and `admin` members. The authenticated controller also reads public statistics through the public endpoint.

The functions select safe columns from `dashboard_aggregates`, `event_settings`, and the private `meet_checkin_control.source` projection. Only the final aggregate payload is exposed:

```json
{
  "eventId": 17135,
  "meet": {
    "registered": 10,
    "checkedIn": 7,
    "checkInRate": 70,
    "lastSuccessfulSync": "2026-10-28T10:00:00Z",
    "verification": "approved",
    "status": "live"
  },
  "match": { "completedMeetings": 3, "targetMeetings": 1200 },
  "grow": { "feedbackCount": 2, "averageRating": 4.5 }
}
```

These are synthetic examples. Unknown attendance remains `meet:null`; a verified zero is a normal count. Durable API source uses freshness and failed-publication timestamps to return `live`, `pending`, or `stale`. Durable `snapshot`, `manual`, and `reset` sources return the existing approved `snapshot` representation, with `publishedAt` instead of `lastSuccessfulSync`. Source labeling no longer depends on the old environment sync gate. Private sync errors and HTTP status codes are never included. A failed API sync preserves stored totals. Query/validation failures return generic `data_unavailable` (503); the browser retains its last valid display and polls stored data every 15 seconds.

`meeting_target` is read on each aggregate fetch. A settings save updates the aggregate notification timestamp, allowing the existing refresh pipeline to recalculate MATCH progress without changing completed meetings.

## Controller reads

All `controller-submit` routes require an authenticated `staff` or `admin` membership. `GET` returns `{actions:[...]}` from `list_controller_actions`. The existing history remains below the check-in controller, with audited submissions, reversals, exact check-in changes, settings operations, and resets. Source identities and participant records are not exposed.

`GET controller-submit?view=checkins` returns `{checkins:{mode,registered,checkedIn,apiCheckedIn,apiAsOf,canReconcile,version,source,manualFallback,canSetExact}}`. `canReconcile` is always false: manual mode cannot return to API mode. `canSetExact` is true only for administrators.

`GET controller-submit?view=settings` is admin-only and returns `{settings:...}` with:

- `role`, `mode` (`api` or `manual`), `syncState` (`stopped`, `starting`, `running`, `syncing`, `failed`, or `manual`), `syncEnabled`.
- Effective `registered`, `checkedIn`, `source`, `version`, `registeredOverride`, `meetingTarget`.
- `lastSuccessAt`, `lastAttemptAt`, `nextSyncAt`, `apiRegistered`, `apiCheckedIn`, `error`, `httpStatus`, `canStart`.

Timestamps are ISO instants; the frontend formats them in Asia/Amman time. Historical API counts remain separate from effective overrides.

## Controller mutations

`POST controller-submit` accepts JSON no larger than 1,024 characters. Every request has a UUID `requestId`; optional `eventId` must equal `17135`. Reusing the same ID/payload is idempotent. Conflicting reuse returns 409. The database checks membership again and persists changes transactionally before success.

| Kind | Additional fields | Authorization and behavior |
| --- | --- | --- |
| `meeting` | `quantity:1\|2\|3` | Staff/admin; one record per meeting, unchanged controls |
| `feedback` | `rating:1..5` integer | Staff/admin; individual rating record, unchanged average calculation |
| `undo` | `originalRequestId`, `reason:duplicate\|wrong_count\|wrong_rating\|other` | Staff/admin; reverses a specific eligible action, preserving audit |
| `checkin` | `quantity:1\|2\|5\|10` (defaults to 1) | Staff/admin; atomic increment only in manual mode, capacity checked |
| `set_checkins` | `checkedIn`, `expectedVersion` | Admin; exact nonnegative integer total, version and capacity checked |
| `start_sync` | `expectedVersion` | Admin; persists enabled state and dispatches the first fetch immediately |
| `stop_sync` | `expectedVersion` | Admin; stops future dispatch and fences in-flight publication |
| `manual_mode` | `expectedVersion` | Admin; permanent manual transition for this event session, fences API results |
| `update_settings` | `expectedVersion`, `registeredOverride?`, `meetingTarget?` | Admin; at least one field; registration is nonnegative and cannot fall below check-ins; target is positive |
| `reset_event` | `expectedVersion`, `confirmation:"RESET EVENT"` | Admin; atomic MATCH/MEET reset, stopped API mode, audited and irreversible through controller |

Numeric counts must be safe integers within PostgreSQL integer range. Versions must be nonnegative safe integers. Exact-total/settings mutations reject stale versions. Check-in increments do not use read/modify/write totals in the browser. Registration overrides are stored separately from raw snapshots and remain authoritative; conflicting API check-ins fail publication without changing displayed counts.

MATCH/GROW success retains the existing `{record,stats}` or `{reversal,stats}` response. Check-in mutations return `{record,checkins}`. Administrative operations return `{record,settings}`. `record` contains only the audit request ID and timestamp. `reset_event` clears effective MATCH and MEET counts and active overrides, prevents historical records/snapshots from repopulating them, preserves ratings, target, accounts, configuration, and historical audit. The frontend also requires the exact typed confirmation. Deployment/testing must never invoke reset on the live event without separate owner approval.

Errors expose classifications only: 400 invalid input; 403 unauthorized role; 409 conflicting request/version, capacity, locked manual mode, or unavailable scheduler; 503 persistence/access uncertainty. A response lost after persistence is retried using the same request ID. Never report success from optimistic client-only values.

## Scheduled synchronization

`POST sync-b2match` has `verify_jwt=false` and checks the dedicated `x-b2match-worker-secret` header against server-only `B2MATCH_WORKER_SECRET` before creating an SDK context. It accepts neither a public API key nor a staff JWT as worker authorization. The secret is separate from Supabase service-role credentials; its matching scheduler copy is in Vault as `nh_b2match_worker_secret`. No browser CORS is provided.

The worker requires a JSON body `{generation:<nonnegative safe integer>}` supplied by the dispatcher; absent or malformed generations return 400. The event-ID environment guard remains. Durable database state, not `B2MATCH_SYNC_ENABLED`, authorizes each worker claim. `claim_meet_sync` serializes against the event control row, due time, existing lease, manual mode, and the dispatch generation. A delayed request from a stopped generation cannot claim a newly started session. `complete_meet_sync` publishes one complete validated snapshot only while that generation still owns its lease and sync remains enabled. Stop, manual mode, reset, and failure fence older runs. `fail_meet_sync` stores safe classification, HTTP status when available, timestamps, and progress; it disables further synchronization and preserves previous counts.

The first dispatch is part of the start operation and executes after its transaction commits. Subsequent dispatch follows the database's 120-second policy. Supabase `pg_cron` wakes the guarded dispatcher, while `pg_net` sends server-side requests; closing the controller has no effect. The scheduler watches dispatch/worker failures so a dead request cannot cause an automatic recovery loop. A worker denied a claim returns `not_due_or_stopped` without contacting B2Match. Success returns only page/record counts. A verified API/parse/publication failure returns 502; failure persistence uncertainty returns 503 for the scheduler watchdog to handle. There are no API retries or automatic restarts.

## Read-only B2Match verification

`POST verify-b2match` remains a separate non-publishing endpoint with named Supabase secret key `b2match_verification`, disabled-by-default `B2MATCH_DRY_RUN_ENABLED`, event-ID gate, and server B2Match key. It has no database write path or browser CORS. It shares the exact parser/counting implementation with the publisher and returns aggregate diagnostics only. `complete` establishes a complete API traversal, not portal parity. A failed pull returns HTTP 424, allowlisted error/field/type diagnostics and null KPI values. The new single-attempt failure policy also applies to this shared client. No real API request is needed to deploy code or test mocks.

## Startup map data boundary

`/map` uses the existing sanitized workbook aggregates in `frontend/src/data/mapSnapshot.json`. This work does not modify the route or its data. The historical `map_dashboard_snapshots` hosted row is retained. See [the workbook integration guide](../integrations/MAP_WORKBOOK.md).
