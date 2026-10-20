# System overview

## Scope and status

The repository covers only the New Horizons 2026 dashboard and staff controller. The source architecture uses React/Vite/TypeScript, Supabase Edge Functions, PostgreSQL, Auth, and Realtime. Frontend hosting remains undecided. The CLI is linked to controlled integration-test project `kkiambvltxuieuncwtfz`; its three migrations, protected controller, and snapshot-aware `dashboard-data` function are deployed. Hosted Auth, controller, RLS, and Realtime tests passed with verified synthetic-data cleanup. The owner confirmed the separate read-only b2match dry-run totals against the admin portal and authorized one static 202-registered/0-checked-in snapshot on 2026-10-16. No automatic b2match sync, named automation key, Cron job, or frontend deployment has been configured.

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
```

The browser never requests b2match or holds its key. Controller writes do not use client-only counters. The one-time portal-confirmed snapshot is labeled `snapshot` while `B2MATCH_SYNC_ENABLED` is off; its timestamp is publication time, not a new API fetch time. Future automatic syncs, if separately approved, publish a complete MEET snapshot in one database transaction; a failed pull preserves the last successful counts and marks them stale. One per-event PostgreSQL lease prevents overlapping runs and rejects a result from an expired lease. The 180-second lease exceeds the client's 120-second pull budget; these limits still require a real Edge runtime duration check.

The deployed staff correction path targets a prior request ID, reverses the whole submission in one transaction, preserves original records, and records actor/reason/time. Its audit schema and Edge Function were exercised with two synthetic meeting actions in the linked test project. The owner separately approved removal of those specific test rows after the rehearsal; normal correction behavior retains the audit trail.

## Migration inventory

| Former component | Classification | Final treatment |
| --- | --- | --- |
| React dashboard layout, brand assets, gauges | Reuse connected metric components and hook; restyle the public display | Reference-matched public composition, compact source/freshness status; controller unaffected |
| Staff controller cards, hooks, mock records | Adapt / preserve for demo | Live Supabase service added; demo stays credential-free |
| b2match client, validation, pagination, aggregation, fixture tests | Adapt for Supabase | Moved to `supabase/functions/_shared` and `supabase/tests` |
| Worker aggregate snapshot class and scheduled handler | Replace | PostgreSQL snapshot, sync lease, and protected Edge Function |
| Worker attendance mock route | Remove after migration | Equivalent frontend-only demo fixture |
| Worker package, Wrangler config, Worker route tests | Remove after migration | No remaining runtime dependency |
| MATCH/GROW synthetic providers | Preserve for demo | Live mode reads persisted aggregates |

## Mode and authorization boundaries

`VITE_DATA_MODE=demo` uses local synthetic MEET/MATCH/GROW values and an in-memory controller. `VITE_DATA_MODE=live` requires a Supabase URL/publishable key, Supabase Auth session, and event membership. The dashboard accepts viewer, staff, and admin memberships; the controller accepts staff and admin. Edge Functions enforce these roles and the database grants/RLS reject direct browser writes. No service or b2match secret is sent to the frontend.

The public display is private by default in live mode. A static frontend may still deliver its HTML and brand assets before sign-in; all event data requests and Realtime rows require an authorized session. The local demo intentionally remains accessible.

The Dashboard opens one authorized Realtime channel per mounted hook instance and refetches `dashboard-data` after aggregate notifications. Each mount uses a distinct channel topic so React Strict Mode's first cleanup cannot close the replacement subscription. A notification received during an in-flight read queues another refetch. The 15-second authoritative read remains the fallback when a notification is missed.

## Pending release decisions

- The owner confirmed the 202/0 dry-run values against the portal. Confirm check-in semantics when real scans occur, measure data propagation, and establish permitted polling frequency. The dry run took 8.248 seconds and 5 API requests; no cadence is approved.
- Measure full sync duration against Supabase Edge Function limits; choose and approve a Cron cadence and freshness threshold. No schedule is active.
- Before enabling automatic sync, give manual and synchronized snapshots distinct durable source metadata so disabling sync later cannot label a formerly live API result as the manual snapshot. The current mode switch is suitable for this one-time publication only.
- The client confirmed 1,200 meetings on 2026-10-15. The hosted event 17135 `meeting_target` is 1,200; `completed_meetings` remains the independent, staff-recorded aggregate. Any later target change needs a separate owner-approved setting update.
- Test actual session expiry and a local database rehearsal. Hosted disposable-account tests covered sign-in, role denial, sequential and simultaneous controller idempotency, distinct staff/admin writes, Realtime delivery/reconnection, and read fallback; rollback-only SQL covered sync lease overlap and atomic publication.
- Approve frontend hosting, operator identities, retention, monitoring, and release.
