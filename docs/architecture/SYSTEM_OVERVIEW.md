# System overview

## Scope and release status

The live dashboard at `/` and authenticated controller at `/controller` use React/Vite/TypeScript, Supabase Edge Functions, PostgreSQL, Auth and Realtime. Cloudflare Pages serves `horizonsevent.pages.dev`; Supabase project `kkiambvltxuieuncwtfz` contains event 17135. The separate `/map` route is outside this change. The [deployment guide](../deployment/DEPLOYMENT.md) records the actual release and rollback evidence; source code and isolated tests alone are not production verification.

## Data flow

- The public browser reads the fixed-event aggregate-only `public-dashboard-data` projection. A read-only event-17135 `dashboard_aggregates` subscription triggers a fresh validated read on changes and successful subscription/reconnection. A 15-second timer remains the fallback. Overlapping reads queue one follow-up; failures retain known values and mark them stale.
- Supabase Auth and event membership gate the controller. Staff/admin retain existing MATCH +1/+2/+3, GROW ratings 1–5, history and audited reversals. Admin-only Settings actions use the same `controller-submit` endpoint and are reauthorized in SQL.
- Start saves enabled state and a new generation, then queues an immediate server-side request. A private pg_cron tick every ten seconds dispatches only due work; due times are 120 seconds from each claimed start, with no concurrent runs or missed-run catch-up. Closing the browser has no scheduling effect.
- The dispatcher reads a dedicated credential from Vault and sends a fixed-destination generation-fenced request to `sync-b2match`. The worker attempts each B2Match page once, preserves established status/check-in/deduplication semantics, and publishes only a validated complete traversal.
- The existing lease, run, snapshot and aggregate tables provide transactionally fenced publication. Stop, failure and manual activation advance the generation. The MATCH/GROW reset leaves attendance synchronization unchanged. The watchdog stops lost dispatches and expired workers. No automatic retry or recovery is implemented.
- A confirmed one-way Manual Mode enables +1/+2/+5/+10 check-ins and admin exact totals against the same effective MEET row. Version checks reject stale exact totals/settings; all adjustments are audited. Registration overrides can be used independently and remain separate from raw API snapshots. They are never overwritten by subsequent API publications.
- The protected reset requires an explicit `match_grow` scope and typed confirmation, marks prior meeting/feedback requests cleared, zeros MATCH completed meetings and GROW count/rating sum, and records before/after audit values. An empty GROW has a null average. MEET counts, manual overrides/session, source, synchronization, target, raw snapshots, accounts and other configuration remain unchanged; the shared control version advances for stale-request protection. It is tested only in isolated data.

## Data and authorization boundaries

The browser never receives B2Match or service-role credentials and never calls B2Match. Public direct access is limited to the event-17135 aggregate counters and timestamps needed for Realtime; no public writes or private control/settings/audit reads are allowed. Only Edge service context can execute mutation RPCs; SQL rechecks membership. Private scheduler helpers use a restricted schema and fixed destination. RLS remains enabled on all exposed tables.

`meet_checkin_control` stores durable source, mode, sync state, version, generation and safe failure metadata. Raw `meet_snapshots` remain distinct from effective `dashboard_aggregates`. A registration override below effective check-ins, or API check-ins above effective registration, is rejected without partial publication. MATCH target comes from `event_settings.meeting_target` and changes without altering meeting records. Individual GROW records remain the basis for the rating aggregate.

## Migration inventory

The four previously hosted migrations establish the original schema, restricted RLS helper, audited reversals and map aggregate. This release applies the previously prepared manual-checkin migration followed by `20261028192045_event_operations_and_sync.sql` and `20261028192319_b2match_server_schedule.sql`. The forward migration `20261028211842_reset_match_grow.sql` corrects only the protected reset function, preserves stored values during deployment, and rejects cached requests with the former scope. The scheduler migration supersedes the earlier reconciliation flow; no controller operation can return to API mode. See [schema](../database/SCHEMA.md) for objects, grants and rollback constraints.

## Operational limits

No live B2Match pull or automatic synchronization is performed during release testing. The permitted upstream quota and actual propagation latency remain unverified; a two-minute local schedule does not prove provider permission or current API compatibility. Production physical-screen acceptance, recovery rehearsal, retention and backup ownership remain operator responsibilities described in the [runbook](../operations/EVENT_DAY_RUNBOOK.md).

## Jordan startup map

The local `/map` redesign is an independent public display backed by `frontend/src/data/mapSnapshot.json`. The private `Map master` workbook is filtered to Acceleration, Go to Market, and Grow+, deduplicated by E4DE code, normalized, grouped into eight sector categories, and reduced to national and governorate aggregates by `scripts/prepare_map_dashboard_data.py`. The frontend receives no startup names, codes, or participant details; the workbook stays outside Git. Selection changes the in-memory aggregate and does not call Supabase, b2match, staff functions, Realtime, or polling. The existing `/` and `/controller` data flows remain separate. The [workbook integration guide](../integrations/MAP_WORKBOOK.md) defines source columns, category mapping, and review flags.

The bundled geometry has 12 governorate boundaries. The current source has 265 eligible startups across eight represented governorates: 150 Acceleration, 91 Go to Market, and 24 Grow+. It excludes 124 `NA`-stage rows, including 15 ICON rows. Two eligible records have missing employee counts per the workbook review column; their numeric zero cells are treated as unknown for employment rather than verified zero. The other four governorates remain geographic context without invented values.

The previously released map used `Participants List.xlsx` and one Supabase `map_dashboard_snapshots` row with 266 startups (150 Acceleration, 92 Go to Market, 24 Grow+). Migration `20261023000100_map_dashboard_snapshots.sql` and the one-row seed were applied to controlled test project `kkiambvltxuieuncwtfz`. Its anonymous Data API read and browser selection checks are historical release evidence; the local redesign does not alter or delete that hosted row. The pre-task production bundle already contains the 265-startup map from commit `83ef1b1`; this readiness release preserves that source and CSS. Newer local icon refinements remain outside this release. No physical LED test is recorded.
