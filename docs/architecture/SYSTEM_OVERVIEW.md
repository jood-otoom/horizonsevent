# System overview

## Scope and status

The repository covers the New Horizons 2026 live dashboard, staff controller, and separate Jordan startup map. The source architecture uses React/Vite/TypeScript, Supabase Edge Functions, PostgreSQL, Auth, and Realtime. Cloudflare Pages serves `https://horizonsevent.pages.dev` from the Git-connected `main` branch. The CLI is linked to project `kkiambvltxuieuncwtfz`; its protected controller, snapshot-aware `dashboard-data` function, public aggregate reader, and map aggregate seed are deployed. The manual check-in migration and modified controller function remain local only. Earlier hosted Auth, controller, RLS, and Realtime tests passed with verified synthetic-data cleanup. The owner confirmed the separate read-only b2match dry-run totals against the admin portal and authorized one static 202-registered/0-checked-in snapshot on 2026-10-16. The repaired `sync-b2match` source was deployed later with its gate disabled and no invocation. No automatic b2match sync, named automation key, or Cron job has been configured.

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

Public dashboard browser -> public-dashboard-data Edge Function -> fixed event 17135 aggregate projection
                         -> 15-second read and browser-online refetch; no anonymous table grant
Authenticated controller -> public-dashboard-data Edge Function -> fixed event 17135 aggregate projection
Authenticated staff -> controller-submit Edge Function -> transactional meeting/feedback RPC
Authenticated staff -> recent action history / reasoned reversal -> aggregate + immutable audit row

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

`VITE_DATA_MODE=demo` uses local synthetic MEET/MATCH/GROW values and an in-memory controller. `VITE_DATA_MODE=live` requires a Supabase URL/publishable key. The public dashboard does not require a user session or membership; its Edge Function uses server-only privilege to read fixed aggregate columns and returns the existing validated display payload. The controller retains Supabase Auth and event membership before it mounts, then reads the same public aggregate as `/`; history and all mutations remain on authenticated, staff/admin-only `controller-submit`. Database grants/RLS still reject direct anonymous dashboard-table reads and all browser writes. No service or b2match secret is sent to the frontend.

The MEET/MATCH/GROW display at `/` is public in live mode and reads only the published display aggregate. The local `/map` redesign reads its sanitized static workbook aggregate from the frontend bundle; it makes no request to b2match or Supabase for map selection. The previously released production map still reads the public map row until an approved frontend release. The local dashboard demo remains labeled synthetic. The authenticated `dashboard-data` endpoint remains deployed for authorized clients, but the frontend no longer calls it.

The public Dashboard has no Realtime subscription: `dashboard_aggregates` RLS is event-member-only. It reads `public-dashboard-data` on mount, every 15 seconds, and when the browser reports reconnection. An overlapping trigger queues one follow-up read; unmount removes the timer and online listener. Controller aggregate reads use that same public endpoint after the Auth gate; controller history and mutations remain authenticated. Earlier authorized Realtime rehearsals below describe the previous dashboard implementation.

## Pending release decisions

- The owner confirmed the 202/0 dry-run values against the portal. Confirm check-in semantics when real scans occur, measure data propagation, and establish permitted polling frequency. The dry run took 8.248 seconds and 5 API requests; no cadence is approved.
- Measure full sync duration against Supabase Edge Function limits; choose and approve a Cron cadence and freshness threshold. No schedule is active.
- Before enabling automatic sync, deploy and rehearse the pending manual-control migration: raw `meet_snapshots` and effective `dashboard_aggregates` remain separate, and the active manual mode prevents automatic count replacement. The current environment-based response status still needs review for durable source labeling after a future live sync.
- The client confirmed 1,200 meetings on 2026-10-15. The hosted event 17135 `meeting_target` is 1,200; `completed_meetings` remains the independent, staff-recorded aggregate. Any later target change needs a separate owner-approved setting update.
- Test actual session expiry and a local database rehearsal. Hosted disposable-account tests covered sign-in, role denial, sequential and simultaneous controller idempotency, distinct staff/admin writes, Realtime delivery/reconnection, and read fallback; rollback-only SQL covered sync lease overlap and atomic publication.
- Confirm Cloudflare Pages build settings and GitHub integration, operator identities, retention, monitoring, and the separate production release approval.

## Jordan startup map

The local `/map` redesign is an independent public display backed by `frontend/src/data/mapSnapshot.json`. The private `Map master` workbook is filtered to Acceleration, Go to Market, and Grow+, deduplicated by E4DE code, normalized, grouped into eight sector categories, and reduced to national and governorate aggregates by `scripts/prepare_map_dashboard_data.py`. The frontend receives no startup names, codes, or participant details; the workbook stays outside Git. Selection changes the in-memory aggregate and does not call Supabase, b2match, staff functions, Realtime, or polling. The existing `/` and `/controller` data flows remain separate. The [workbook integration guide](../integrations/MAP_WORKBOOK.md) defines source columns, category mapping, and review flags.

The bundled geometry has 12 governorate boundaries. The current source has 265 eligible startups across eight represented governorates: 150 Acceleration, 91 Go to Market, and 24 Grow+. It excludes 124 `NA`-stage rows, including 15 ICON rows. Two eligible records have missing employee counts per the workbook review column; their numeric zero cells are treated as unknown for employment rather than verified zero. The other four governorates remain geographic context without invented values.

The previously released map used `Participants List.xlsx` and one Supabase `map_dashboard_snapshots` row with 266 startups (150 Acceleration, 92 Go to Market, 24 Grow+). Migration `20261023000100_map_dashboard_snapshots.sql` and the one-row seed were applied to controlled test project `kkiambvltxuieuncwtfz`. Its anonymous Data API read and browser selection checks are historical release evidence; the local redesign does not alter or delete that hosted row. No frontend deployment or physical LED test has occurred for the redesign.

## Local emergency check-in refinement — pending deployment

`/controller` now reveals a compact check-in card on demand. `controller-submit` authenticates and authorizes `checkin` and `reconcile_checkins`; SQL RPCs serialize them with `meet_checkin_control` row locks and retain each original request and reversal. The first manual `+1` anchors a manual session to the current effective aggregate. Later API pulls continue writing raw `meet_snapshots` and registered totals, but preserve the displayed manual checked-in count. The staff control exposes the latest API count and an explicit source-switch confirmation only after a newer API snapshot. A lower registration count that cannot contain the manual effective count rejects publication, preserving the prior aggregate. In current source, public `public-dashboard-data` polling is the display path; the authenticated controller reads the same public aggregate while preserving private operations. Historical Realtime behavior above predates the public-read change. No participant identifiers are stored by this feature.

The currently deployed test project has none of this migration or function code. Its automatic b2match gate remains off; the old static 202/0 snapshot is unchanged by local edits. The `/map` heat-map classes in the redesign derive from the bundled workbook aggregate. Both display routes use the individual supplied partner assets and complete-dot artwork; only `/map` receives choropleth styling.
