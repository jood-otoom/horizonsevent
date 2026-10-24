# New Horizons 2026 Live Event Dashboard

**2026-10-24 hosted status (event 17135):** A guarded, audited reset and subsequent controller rehearsal left MATCH at 0 and GROW at 0 submissions / 0 rating sum. The existing MEET snapshot remains 202 registered / 0 checked in, published on 2026-10-16 at 01:14:50 Asia/Amman. The dashboard and controller showed the reset values. The requested hourly b2match schedule is **not active**: the latest deployed parser has not completed a live verification, the permitted API polling cadence is unconfirmed, and scheduler credentials/extensions are not configured. No new frontend or Edge Function release was made in this work item. See the [database](docs/database/SCHEMA.md), [integration](docs/integrations/B2MATCH_API.md), [testing](docs/testing/TEST_STRATEGY.md), and [deployment](docs/deployment/DEPLOYMENT.md) guides for evidence and prerequisites.

The repository contains the reference-matched live dashboard at `/`, staff controller at `/controller`, and interactive Jordan startup map at `/map`. The frontend is React, Vite, and TypeScript. The backend is Supabase Edge Functions and PostgreSQL. The CLI is linked to controlled integration-test project `kkiambvltxuieuncwtfz`; its four migrations, protected controller, and one aggregate-only map snapshot are present there. No map frontend has been deployed. The client confirmed a 1,200-meeting target on 2026-10-15. An authorized 2026-10-16 browser rehearsal verified controller persistence, request-ID idempotency, and Dashboard Realtime delivery, then removed only its approved synthetic fixture rows. That cleanup returned the meeting total to 0 at the time; later records may change it. A 2026-10-18 connected browser read found 9 meetings and 3 feedback records before this redesign's reversible +1 test.

On 2026-10-16 the owner confirmed that the b2match dry-run totals match the admin portal and approved a **one-time static publication**: 202 registered, 0 checked in, 0%. The one canceled participant is excluded from the registered count and is not shown. A guarded transaction published one aggregate snapshot at 01:14:50 Asia/Amman. The dashboard keeps snapshot metadata internal while displaying the approved count and an independent live Jordan clock. On 2026-10-21, owner-approved **code-only** deployments aligned both b2match functions with the same strict parser. A subsequent strict read-only verifier call failed on an empty `pagination.nextPageToken` after four accepted pages and returned no current counts. A further owner-approved code-only release deployed the guarded empty-terminal-token repair to `verify-b2match` v27 and `sync-b2match` v25. Fresh downloads matched every approved local source file and the shared parser matched between deployed functions. This repair has synthetic tests but has **not** been tried against the live fifth page. The older API-only 230/0 result predates parser alignment and still needs current portal confirmation. Both gates were confirmed `false`, Cron remains absent, and read-only checks found the same one snapshot, zero sync runs and leases, and unchanged aggregate row. **No publishing sync or Cron schedule was enabled. Publication remains blocked pending a separately approved strict read-only verification and current portal comparison.** Demo mode uses clearly labeled synthetic values and needs no API key.

## Requirements and local demo

Use Node.js 22.12 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL printed in the terminal. `VITE_DATA_MODE=demo` is the default. The demo dashboard and controller make no external requests; controller records last for the current page session only. `/map` always reads the published Supabase aggregate from the configured project and never substitutes demo startup counts. A missing or invalid row produces a controlled error state. With the linked test project's URL and publishable key, `/map` currently shows the approved workbook-derived 266-startup snapshot.

## Jordan startup map

The supplied `Participants List.xlsx` contains private contact information and is ignored by Git. To regenerate the aggregate-only seed after a reviewed workbook update, run `python3 scripts/prepare_map_snapshot.py 'Participants List.xlsx'`, then `python3 -m unittest discover -s scripts -p 'test_prepare_map_snapshot.py' -v`. The script refuses unknown stages, missing boundaries, or totals that differ from the reviewed workbook. Review any future SQL and use the [deployment procedure](docs/deployment/DEPLOYMENT.md) before changing the existing published row; the initial insert must not be rerun against that row. No startup profile or contact column was sent to Supabase.

The development preview is optimized for 1792×1024. The map uses the existing 12-governorate SVG geometry and colors only the eight represented regions from the validated aggregate; selection updates locally. The [UI and branding guide](docs/frontend/UI_AND_BRANDING.md) documents the color classification and links the latest 1792×1024 and 1366×768 local browser captures using the hosted test-project aggregate. Neither is a production deployment or physical LED acceptance.

## LED presentation

Open `/` at 100% browser zoom and put the browser in fullscreen or kiosk mode manually. The dashboard already uses the full viewport; no query parameter or separate data path is needed. Its reference composition is tuned for a 7:4 screen with a 1792×1024 development preview and about 3% safe margins around important content. The actual LED processor pixel resolution is still unconfirmed. At the venue, configure the processor and computer for the processor's native output resolution with 1:1 mapping, disable overscan, then verify the full screen and safe area on the physical display. The dashboard cannot enter browser fullscreen automatically without user interaction. See the [UI and branding guide](docs/frontend/UI_AND_BRANDING.md) for preview screenshots and the known raster-logo limitation.

## Local Supabase integration

Install Docker Desktop and Supabase CLI 2.120.0 (or use `pnpm dlx supabase@2.120.0`). These were not available as a running local database during this change. From the repository root:

```sh
pnpm dlx supabase@2.120.0 start
pnpm dlx supabase@2.120.0 db reset --local --no-seed
pnpm dlx supabase@2.120.0 functions serve
```

`db reset --local` replaces the **local** Supabase database. Do not point it at a hosted project. Copy only the `VITE_*` entries from `.env.example` to `frontend/.env.local`, set `VITE_DATA_MODE=live`, and use the local URL and publishable key printed by `supabase start`. Add the exact local Vite origin to an ignored local Edge Function env file as `DASHBOARD_ALLOWED_ORIGINS`. Create a local Auth user in Studio, then assign that user's UUID a `viewer`, `staff`, or `admin` membership for event 17135 in `public.event_memberships`. Local `staff` and `admin` may submit controller records. Without a b2match key and approved sync, MEET correctly remains unavailable; MATCH and GROW are database backed.

To test protected functions, sign in through the live UI. `dashboard-data` requires a viewer, staff, or admin session; `controller-submit` requires staff or admin. `sync-b2match` requires a named Supabase secret key `automations` and `B2MATCH_SYNC_ENABLED=true`; leave it disabled for ordinary local work. Never put b2match or Supabase secret keys in `VITE_*` variables or chat.

For the hosted integration test project, `frontend/.env.local` points to the linked project in live mode. Its Edge Function allowlist accepts `http://127.0.0.1:5173` and `http://127.0.0.1:5176`; `localhost` is a different origin and is not allowlisted. Run Vite on a matching port and host. The protected dashboard and controller still require an event member sign-in; `/map` reads only its public aggregate row without sign-in. On 2026-10-16, an authorized Safari rehearsal started at 0, submitted one +1 action, and observed a `postgres_changes` frame followed by an authoritative `dashboard-data` refetch before the 15-second poll. The unrefreshed Dashboard showed 1 of 1,200 (0.08%); refresh and a new tab retained it. The same request ID did not double count. The action was reversed, and both verified synthetic requests, meeting rows, and reversal rows were removed. Immediately after that cleanup, the project displayed 0 of 1,200 with no meeting history. Later records changed this; the 2026-10-18 read found 9 of 1,200 before this task's reversible test. See the [test strategy](docs/testing/TEST_STRATEGY.md) for timing and screenshots.

Staff correction and recent history are active in the linked test project. The Controller successfully reversed both synthetic submissions with audit records before the explicitly approved fixture cleanup. The local demo exercises the same flow without persistence. Automatic MEET synchronization, production release, and event-day recovery rehearsal remain separate work.

See [deployment](docs/deployment/DEPLOYMENT.md) for later hosted-project setup, review gates, and rollback.

## Repository map

- `frontend/` — preserved dashboard/controller UI, demo providers, live Supabase Auth and aggregate clients.
- `frontend/src/pages/MapDashboard.tsx` — separate `/map` display using one published aggregate.
- `supabase/functions/` — protected sync, dashboard read, controller submit, and gated service-only dry-run functions; shared validated b2match logic.
- `supabase/migrations/` — event-scoped PostgreSQL tables, RLS, transactional functions, aggregate-only Realtime publication, and the applied map snapshot table.
- `supabase/seed/map_dashboard_snapshot.sql` — reviewed workbook-derived startup aggregates only; its one initial row is applied in the linked test project.
- `supabase/verification/publish_portal_snapshot.sql` — guarded, one-time 202/0 publication; it creates no sync run or schedule and refuses a repeat.
- `docs/` — architecture, schema, contracts, integration, security, testing, and deployment.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These commands test frontend and pure Edge Function logic. The linked hosted database previously passed rollback-only grants, RLS, controller, lease, and Realtime-publication checks, plus synthetic Auth/Edge/Realtime integration tests. The b2match dry run fetched 5 pages and 203 records in 5 upstream requests over 8.248 seconds; the owner subsequently confirmed portal parity. The manual publication was previewed with `ROLLBACK`, committed once, and verified by a fresh database read and local Safari dashboard. Actual new-registration/check-in propagation, expired-session behavior, a local Docker database, and production rehearsal remain pending. Each Edge Function has a pinned `deno.json` and `deno.lock`; run `deno check index.ts` from each function directory when Deno is available.

## Canonical documentation

- [System overview and migration inventory](docs/architecture/SYSTEM_OVERVIEW.md)
- [Frontend UI and branding](docs/frontend/UI_AND_BRANDING.md)
- [Backend API contracts](docs/backend/API_CONTRACTS.md)
- [Database schema](docs/database/SCHEMA.md)
- [b2match integration](docs/integrations/B2MATCH_API.md)
- [Security](docs/security/SECURITY.md)
- [Test strategy](docs/testing/TEST_STRATEGY.md)
- [Deployment](docs/deployment/DEPLOYMENT.md)

## Local check-in fallback refinement (not deployed)

The `/controller` page now has an on-demand `Check-ins Controller` beneath MATCH and GROW. Its `+1` request is authenticated, idempotent, auditable, and intended to keep MEET current during an API outage after migration `20261023172257_manual_checkin_fallback.sql` and the updated `controller-submit` function are reviewed and deployed. Automatic b2match synchronization remains disabled. The dashboard's public numbers, Realtime refetch, and 15-second fallback read use the existing aggregate route. See the [architecture](docs/architecture/SYSTEM_OVERVIEW.md), [schema](docs/database/SCHEMA.md), [API contract](docs/backend/API_CONTRACTS.md), and [event-day runbook](docs/operations/EVENT_DAY_RUNBOOK.md). Until the migration and function are deployed together, the live check-in control cannot submit; local demo mode exercises only synthetic in-memory behavior.
