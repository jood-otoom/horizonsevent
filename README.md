# New Horizons 2026 Live Event Dashboard

The repository contains the reference-matched live dashboard at `/` and staff controller at `/controller`. The frontend is React, Vite, and TypeScript. The backend is Supabase Edge Functions and PostgreSQL. The CLI is linked to controlled integration-test project `kkiambvltxuieuncwtfz`; its three migrations and the protected controller are deployed. The client confirmed a 1,200-meeting target on 2026-10-15. An authorized 2026-10-16 browser rehearsal verified controller persistence, request-ID idempotency, and Dashboard Realtime delivery, then removed only its approved synthetic fixture rows. That cleanup returned the meeting total to 0 at the time; later records may change it. A 2026-10-18 connected browser read found 9 meetings and 3 feedback records before this redesign's reversible +1 test.

On 2026-10-16 the owner confirmed that the b2match dry-run totals match the admin portal and approved a **one-time static publication**: 202 registered, 0 checked in, 0%. The one canceled participant is excluded from the registered count and is not shown. A guarded transaction published one aggregate snapshot at 01:14:50 Asia/Amman; a fresh hosted read found one snapshot and zero sync runs or leases. The local signed-in Dashboard presents the one-time MEET publication in a compact status line marked as a portal-verified snapshot with no automatic updates. **No publishing b2match sync was invoked or enabled, and no Cron schedule, named automation key, or frontend host was configured.** The read-only verifier remains gated off. Demo mode uses clearly labeled synthetic values and needs no API key.

## Requirements and local demo

Use Node.js 22.12 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL printed in the terminal. `VITE_DATA_MODE=demo` is the default. The demo dashboard and controller make no external requests; controller records last for the current page session only.

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

For the hosted integration test project, `frontend/.env.local` points to the linked project in live mode. Its Edge Function allowlist accepts `http://127.0.0.1:5173` and `http://127.0.0.1:5176`; `localhost` is a different origin and is not allowlisted. Run Vite on a matching port and host. The browser must still sign in with an event member account. On 2026-10-16, an authorized Safari rehearsal started at 0, submitted one +1 action, and observed a `postgres_changes` frame followed by an authoritative `dashboard-data` refetch before the 15-second poll. The unrefreshed Dashboard showed 1 of 1,200 (0.08%); refresh and a new tab retained it. The same request ID did not double count. The action was reversed, and both verified synthetic requests, meeting rows, and reversal rows were removed. Immediately after that cleanup, the project displayed 0 of 1,200 with no meeting history. Later records changed this; the 2026-10-18 read found 9 of 1,200 before this task's reversible test. See the [test strategy](docs/testing/TEST_STRATEGY.md) for timing and screenshots.

Staff correction and recent history are active in the linked test project. The Controller successfully reversed both synthetic submissions with audit records before the explicitly approved fixture cleanup. The local demo exercises the same flow without persistence. Automatic MEET synchronization, production release, and event-day recovery rehearsal remain separate work.

See [deployment](docs/deployment/DEPLOYMENT.md) for later hosted-project setup, review gates, and rollback.

## Repository map

- `frontend/` — preserved dashboard/controller UI, demo providers, live Supabase Auth and aggregate clients.
- `supabase/functions/` — protected sync, dashboard read, controller submit, and gated service-only dry-run functions; shared validated b2match logic.
- `supabase/migrations/` — event-scoped PostgreSQL tables, RLS, transactional functions, and aggregate-only Realtime publication.
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
# horizonsevent
