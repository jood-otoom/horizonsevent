# System overview

## Scope and status

The repository covers the New Horizons 2026 live dashboard, staff controller, and separate Jordan startup map. The source architecture uses React/Vite/TypeScript, Supabase Edge Functions, PostgreSQL, Auth, and Realtime. Frontend hosting remains undecided. The CLI is linked to controlled integration-test project `kkiambvltxuieuncwtfz`; its first four migrations, protected controller, snapshot-aware `dashboard-data` function, and aggregate-only map seed are deployed. The manual check-in migration and modified controller function remain local only. Hosted Auth, controller, RLS, and Realtime tests passed with verified synthetic-data cleanup. The owner confirmed the separate read-only b2match dry-run totals against the admin portal and authorized one static 202-registered/0-checked-in snapshot on 2026-10-16. The repaired `sync-b2match` source was deployed as v20 in an owner-approved code-only release on 2026-10-21, with its gate disabled and no invocation. No automatic b2match sync, named automation key, Cron job, or frontend deployment has been configured.

## Data flow

```text
Supabase Cron (prepared, inactive) -> secret-key sync-b2match Edge Function
  -> fixed HTTPS b2match participants API -> complete validated pagination
  -> unique registered / historical event-entrance check-in counts
  -> PostgreSQL lease + transactional snapshot publication
  -> aggregate-only dashboard_aggregates Realtime changes

Owner-approved one-off verification -> separate secret-key verify-b2match Edge Function
  -> same validated complete pagination -> aggregate and safe diagnostics only
  -> no database call or dashboard publication

Owner-confirmed one-time publication -> guarded SQL transaction
  -> one aggregate snapshot (202 registered / 0 checked in)
  -> snapshot-aware dashboard-data response; no sync run or schedule

Authenticated viewer -> dashboard-data Edge Function -> RLS-scoped safe aggregates
Authenticated staff -> controller-submit Edge Function -> transactional meeting/feedback RPC
Authenticated staff -> recent action history / reasoned reversal -> aggregate + immutable audit row
Dashboard browser -> Realtime notification -> dashboard-data refetch
                  -> 15-second bounded read fallback

Public map browser -> Supabase Data API -> RLS-protected aggregate map snapshot
                   -> local governorate selection; no staff mutation or Realtime
```

The browser never requests b2match or holds its key. Controller writes do not use client-only counters. The one-time portal-confirmed snapshot is labeled `snapshot` while `B2MATCH_SYNC_ENABLED` is off; its timestamp is publication time, not a new API fetch time. Future automatic syncs, if separately approved, must use the same participant-status and event-entrance validation as the read-only verifier before publishing a complete MEET snapshot in one database transaction. A failed pull preserves the last successful counts and marks them stale. One per-event PostgreSQL lease prevents overlapping runs and rejects a result from an expired lease. The 180-second lease exceeds the client's 120-second pull budget; these limits still require a real Edge runtime duration check.

The deployed staff correction path targets a prior request ID, reverses the whole submission in one transaction, preserves original records, and records actor/reason/time. Its audit schema and Edge Function were exercised with two synthetic meeting actions in the linked test project. The owner separately approved removal of those specific test rows after the rehearsal; normal correction behavior retains the audit trail.

## Migration inventory

| Former component | Classification | Final treatment |
| --- | --- | --- |
| React dashboard layout, brand assets, gauges | Reuse connected metric components and hook; restyle the public display | Reference-matched public composition with presentation-focused connection state; compact controller |
| Staff controller cards, hooks, mock records | Adapt / preserve for demo | Live Supabase service added; demo stays credential-free |
| b2match client, validation, pagination, aggregation, fixture tests | Adapt for Supabase | Moved to `supabase/functions/_shared` and `supabase/tests` |
| Worker aggregate snapshot class and scheduled handler | Replace | PostgreSQL snapshot, sync lease, and protected Edge Function |
| Worker attendance mock route | Remove after migration | Equivalent frontend-only demo fixture |
| Worker package, Wrangler config, Worker route tests | Remove after migration | No remaining runtime dependency |
| MATCH/GROW synthetic providers | Preserve for demo | Live mode reads persisted aggregates |

## Mode and authorization boundaries

`VITE_DATA_MODE=demo` uses local synthetic MEET/MATCH/GROW values and an in-memory controller. `VITE_DATA_MODE=live` requires a Supabase URL/publishable key, Supabase Auth session, and event membership. The dashboard accepts viewer, staff, and admin memberships; the controller accepts staff and admin. Edge Functions enforce these roles and the database grants/RLS reject direct browser writes. No service or b2match secret is sent to the frontend.

The MEET/MATCH/GROW dashboard display is private by default in live mode. A static frontend may still deliver its HTML and brand assets before sign-in; its event data requests and Realtime rows require an authorized session. The separate `/map` route reads one public aggregate row with a publishable key. The local dashboard demo intentionally remains accessible.

The Dashboard opens one authorized Realtime channel per mounted hook instance and refetches `dashboard-data` after aggregate notifications. Each mount uses a distinct channel topic so React Strict Mode's first cleanup cannot close the replacement subscription. A notification received during an in-flight read queues another refetch. The 15-second authoritative read remains the fallback when a notification is missed.

## Pending release decisions

- The owner confirmed the 202/0 dry-run values against the portal. Confirm check-in semantics when real scans occur, measure data propagation, and establish permitted polling frequency. The dry run took 8.248 seconds and 5 API requests; no cadence is approved.
- Measure full sync duration against Supabase Edge Function limits; choose and approve a Cron cadence and freshness threshold. No schedule is active.
- Before enabling automatic sync, deploy and rehearse the pending manual-control migration: raw `meet_snapshots` and effective `dashboard_aggregates` remain separate, and the active manual mode prevents automatic count replacement. The current environment-based response status still needs review for durable source labeling after a future live sync.
- The client confirmed 1,200 meetings on 2026-10-15. The hosted event 17135 `meeting_target` is 1,200; `completed_meetings` remains the independent, staff-recorded aggregate. Any later target change needs a separate owner-approved setting update.
- Test actual session expiry and a local database rehearsal. Hosted disposable-account tests covered sign-in, role denial, sequential and simultaneous controller idempotency, distinct staff/admin writes, Realtime delivery/reconnection, and read fallback; rollback-only SQL covered sync lease overlap and atomic publication.
- Approve frontend hosting, operator identities, retention, monitoring, and release.

## Jordan startup map (test-project aggregate published)

`/map` is an independent public aggregate display. It reads one `map_dashboard_snapshots` row for event 17135 through the existing Supabase URL/publishable key, validates all stage/governorate sums, then changes the selection locally. It does not use the dashboard demo fixtures, staff mutations, Realtime, polling, or b2match. The existing `/` and `/controller` routes retain their current flows. Migration `20261023000100_map_dashboard_snapshots.sql` and its one-row aggregate seed were applied to controlled test project `kkiambvltxuieuncwtfz`. RLS and grants allow signed-out and signed-in viewers to read this aggregate row, while browser roles have no write grant. This is a deliberate public-data boundary for startup statistics only.

`Participants List.xlsx` is the local source for the initial snapshot; the generator writes only nationwide and eight-governorate totals to `supabase/seed/map_dashboard_snapshot.sql`. The workbook is ignored by Git because it contains private contact columns. The map geometry is a bundled 12-governorate ADM1 file; eight represented regions are selectable. A fresh hosted row read found 266 startups across eight governorates, with 150 Acceleration, 24 Grow+, and 92 Go to Market. Anonymous Data API access returned that row, while private event settings and map writes were denied. A local 1792×1024 browser using the hosted row rendered the nationwide total, selected Aqaba by click and keyboard (84 total; 44/4/36 stages), and restored 266 after reset and reload without document overflow. This verifies the test-project data path and local browser rendering; no frontend deployment or physical LED test occurred.

## Local emergency check-in refinement — pending deployment

`/controller` now reveals a compact check-in card on demand. `controller-submit` authenticates and authorizes `checkin` and `reconcile_checkins`; SQL RPCs serialize them with `meet_checkin_control` row locks and retain each original request and reversal. The first manual `+1` anchors a manual session to the current effective aggregate. Later API pulls continue writing raw `meet_snapshots` and registered totals, but preserve the displayed manual checked-in count. The staff control exposes the latest API count and an explicit source-switch confirmation only after a newer API snapshot. A lower registration count that cannot contain the manual effective count rejects publication, preserving the prior aggregate. `dashboard-data`, Realtime, and the 15-second read fallback remain the display path. No participant identifiers are stored by this feature.

The currently deployed test project has none of this migration or function code. Its automatic b2match gate remains off; the old static 202/0 snapshot is unchanged by local edits. The `/map` route keeps its single aggregate read and now derives six heat-map classes locally from that validated snapshot. Both display routes opt into the individual supplied partner assets and complete-dot artwork; only `/map` receives choropleth styling.
