# New Horizons 2026 Live Event Dashboard

The public dashboard is at https://horizonsevent.pages.dev/ and the authenticated staff controller is at https://horizonsevent.pages.dev/controller. Event 17135 uses Supabase project `kkiambvltxuieuncwtfz`. The October 28 readiness change added admin Settings, server-side two-minute synchronization, one-way Manual Mode, check-in increments/exact totals, registration overrides, editable meeting targets and a guarded MATCH/MEET reset under the earlier scope. The current reset contract below supersedes that earlier scope and affects MATCH and GROW only. The October 29 cadence migration changes subsequent sync due times to 30 seconds from each claimed start; it is applied to the hosted database, and the matching controller bundle was verified on the public Pages site. The [deployment guide](docs/deployment/DEPLOYMENT.md) records release evidence and remaining checks. The owner subsequently started B2Match and fetched new totals. The October 29 repair addresses disabled Stop/Reset controls and simplifies Settings navigation; the production artifact and authenticated Reset controls were verified; see the deployment guide for exact evidence. Synchronization was explicitly stopped during recovery without changing event counters; it was running again before the cadence migration. A current portal/API comparison remains an operator acceptance item.

The October 29 public branding release places German Cooperation and EU marks on the left and the Ministry mark on the right of both public headers, with GIZ / ICON INSTITUT / PEM CONSULT in both footers. The dashboard alone has one lower-right flower. See the [UI and branding guide](docs/frontend/UI_AND_BRANDING.md) for the 1792×1024 previews and the [deployment guide](docs/deployment/DEPLOYMENT.md) for production verification.

The October 29 cadence migration was applied while synchronization was running; opening Settings does not change that state. Opening Settings does not start it or reset data. Reset requires the administrator to type `RESET EVENT` and submit the explicit `scope:"match_grow"`; the agent must never run it on the live event without separate approval. It clears MATCH completed meetings and GROW feedback count/rating sum, leaving the average `null` until a new rating exists. MEET totals, registration override, source, manual session, synchronization state/timestamps, and snapshots remain unchanged; the MATCH target, accounts, and retained audit records are preserved. Older cached-client reset requests without the scope are rejected. Read [event-day operations](docs/operations/EVENT_DAY_RUNBOOK.md) before operating the controller. Manual Mode is permanent for this operating session and has no return-to-API control.

The public display reads the existing aggregate Edge endpoint, refetches on aggregate Realtime notifications and browser reconnection, and retains its 15-second polling fallback. Only aggregate counters/timestamps are publicly readable; private controls, audit, settings and every mutation require authorization. See the [security guide](docs/security/SECURITY.md).

The owner merged the map/icon and event-readiness changes into production at `947e944`. The October 29 controller repair preserves that map source and changes no map behavior; earlier artifact releases are recorded as historical deployment evidence.

## Requirements and local demo

Use Node.js 22.12 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL printed in the terminal. `VITE_DATA_MODE=demo` is the default. The demo dashboard and controller make no external requests; controller records last for the current page session only. The local `/map` route uses the checked-in, aggregate-only snapshot generated from `Map Data.xlsx`; governorate selection uses that same in-memory dataset. The production map still serves the earlier 265-startup source until a separately approved release.

## Jordan startup map

The local map uses `Map Data.xlsx`. Its 666 visible source rows cover all 12 governorates; the owner confirmed that each row represents a distinct startup and that the `Staff Delta` column represents current employees for this dashboard. The workbook does not contain startup IDs in that visible table, so uniqueness cannot be independently checked from its fields. It contains 22 missing or unmapped sector values, kept in the calculation and shown as an unclassified count rather than guessed into a sector. The source workbook is currently tracked in Git and contains additional legacy sheets; review its repository exposure before release. The generated browser bundle includes aggregates only. To regenerate and audit the frontend JSON after a reviewed update, run:

```sh
python3 scripts/prepare_map_dashboard_data.py 'Map Data.xlsx'
MAP_WORKBOOK_PATH='Map Data.xlsx' python3 -m unittest discover -s scripts -p 'test_prepare_map_dashboard_data.py' -v
```

The validated local aggregate has 666 startups, 427 female-led and 239 male-led, 192 startups employing, and 628 employees under those owner-confirmed definitions. The previous 265 was generated from the workbook's unchanged hidden `Map master` sheet by a stage filter. A historical 266-startup seed from a different workbook included one additional Amman record, Rewaq; a possible matching excluded row exists in the hidden sheet, but its identity is unverified. Review the [workbook mapping, counts, and data-quality guide](docs/integrations/MAP_WORKBOOK.md) before release. Do not rerun the historical `Participants List.xlsx` SQL seed.

The map has a pin and selectable region for each of the 12 represented governorates. It keeps value-based heat colors, no visible governorate labels, and one-click selection/reset across all cards. The page no longer shows the Jordan heading, programme-stage journey, or venue-facing boundary line. Its seven classified sector tiles retain the full 666-row denominator and disclose unclassified rows separately. The Gender and Employment cards share one layout, and the footer uses the main dashboard flower. The map targets 3840×2160 first, then 1920×1080, 1792×1024, and 1366×768. See the [UI and branding guide](docs/frontend/UI_AND_BRANDING.md) and [boundary credits](docs/integrations/MAP_WORKBOOK.md#map-geometry-credits). A local preview is not a production deployment or physical-screen acceptance.

## LED presentation

Open `/` at 100% browser zoom and put the browser in fullscreen or kiosk mode manually. The dashboard already uses the full viewport; no query parameter or separate data path is needed. Its reference composition is tuned for a 7:4 screen with a 1792×1024 development preview and about 3% safe margins around important content. The actual LED processor pixel resolution is still unconfirmed. At the venue, configure the processor and computer for the processor's native output resolution with 1:1 mapping, disable overscan, then verify the full screen and safe area on the physical display. The dashboard cannot enter browser fullscreen automatically without user interaction. See the [UI and branding guide](docs/frontend/UI_AND_BRANDING.md) for preview screenshots and the known raster-logo limitation.

## Local Supabase integration

Install Docker Desktop and Supabase CLI 2.120.0 (or use `pnpm dlx supabase@2.120.0`). These were not available as a running local database during this change. From the repository root:

```sh
pnpm dlx supabase@2.120.0 start
pnpm dlx supabase@2.120.0 db reset --local --no-seed
pnpm dlx supabase@2.120.0 functions serve
```

`db reset --local` replaces the **local** Supabase database. Do not point it at a hosted project. Copy only the `VITE_*` entries from `.env.example` to `frontend/.env.local`, set `VITE_DATA_MODE=live`, and use the local URL and publishable key printed by `supabase start`. Add the exact local Vite origin to an ignored local Edge Function env file as `DASHBOARD_ALLOWED_ORIGINS`. To test the controller, create a local Auth user in Studio, then assign that user's UUID a `staff` or `admin` membership for event 17135 in `public.event_memberships`. A viewer membership permits only the legacy authenticated dashboard read. Without a b2match key and approved sync, MEET correctly remains unavailable; MATCH and GROW are database backed.

To test protected functions, sign in through `/controller`. `public-dashboard-data` accepts anonymous GET only; `dashboard-data` still requires a viewer, staff, or admin session, and `controller-submit` requires staff or admin. `sync-b2match` requires a dedicated worker secret, a generation-fenced dispatch and enabled durable database state; leave it stopped for ordinary local work. Never put b2match or Supabase secret keys in `VITE_*` variables or chat.

For the hosted integration test project, `frontend/.env.local` points to the linked project in live mode. Its Edge Function allowlist accepts `http://127.0.0.1:5173` and `http://127.0.0.1:5176`; `localhost` is a different origin and is not allowlisted. Run Vite on a matching port and host. During that historical rehearsal, the deployed dashboard and controller required event member sign-in; `/map` read only its public aggregate row without sign-in. On 2026-10-16, an authorized Safari rehearsal started at 0, submitted one +1 action, and observed a `postgres_changes` frame followed by an authoritative `dashboard-data` refetch before the 15-second poll. The unrefreshed Dashboard showed 1 of 1,200 (0.08%); refresh and a new tab retained it. The same request ID did not double count. The action was reversed, and both verified synthetic requests, meeting rows, and reversal rows were removed. Immediately after that cleanup, the project displayed 0 of 1,200 with no meeting history. Later records changed this; the 2026-10-18 read found 9 of 1,200 before this task's reversible test. See the [test strategy](docs/testing/TEST_STRATEGY.md) for timing and screenshots.

Staff correction and recent history are active in the linked test project. The Controller successfully reversed both synthetic submissions with audit records before the explicitly approved fixture cleanup. The local demo exercises the same flow without persistence. Automatic MEET synchronization, production release, and event-day recovery rehearsal remain separate work.

See [deployment](docs/deployment/DEPLOYMENT.md) for later hosted-project setup, review gates, and rollback.

## Repository map

- `frontend/` — preserved dashboard/controller UI, demo providers, live Supabase Auth and aggregate clients.
- `frontend/src/pages/MapDashboard.tsx` — separate `/map` display using one static, aggregate-only workbook snapshot.
- `frontend/src/components/ui/DashboardIcon.tsx` — reusable display of the owner-approved transparent PNG icons in their original colors on the map and event pillars.
- `frontend/public/icons/png/` — 15 owner-approved transparent PNG icons used by both public dashboards; the source images are 104–228 pixels wide, so inspect their edges on the venue display.
- `frontend/src/data/mapSnapshot.json` — generated national and per-governorate counts with no source records.
- `scripts/prepare_map_dashboard_data.py` — reviewable import from the private visible support-measures table, cross-checked against the derived map sheet.
- `supabase/functions/` — public aggregate dashboard read, authenticated dashboard/controller functions, protected sync, and gated service-only dry-run functions; shared validated b2match logic.
- `supabase/migrations/` — event-scoped PostgreSQL tables, RLS, transactional functions, aggregate-only Realtime publication, and the applied map snapshot table.
- `supabase/seed/map_dashboard_snapshot.sql` — historical 266-startup aggregate seed already applied in the linked test project; the new map frontend does not update that row.
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
- [Map workbook and boundary credits](docs/integrations/MAP_WORKBOOK.md)
- [Security](docs/security/SECURITY.md)
- [Test strategy](docs/testing/TEST_STRATEGY.md)
- [Deployment](docs/deployment/DEPLOYMENT.md)

## Isolated readiness tests

Use `NH_PGLITE_RUNTIME=/path/to/runtime node supabase/verification/run_isolated.mjs` with `@electric-sql/pglite@0.3.14` installed in that runtime directory. This runner creates in-memory synthetic databases and mocked scheduler interfaces, accepts no hosted database URL, and tests manual controls, reset preservation, authorization, fencing and scheduling without calling B2Match. Full commands and test limitations are in the [test strategy](docs/testing/TEST_STRATEGY.md).
