# Security and privacy

## Release status and ownership

This document describes the deployed function/schema implementation. Read-only plugin source downloads matched all five deployed functions and their returned dependencies/configuration to local release files; SQL confirmed applied event-control migrations and the anonymous aggregate SELECT policy with RLS enabled. Synchronization was Stopped with zero runs/leases during the October 28 release check; it was Running when the October 29 cadence migration was applied. [Deployment evidence](../deployment/DEPLOYMENT.md) is authoritative for bundle versions/hashes, secret provisioning, frontend verification, and remaining behavioral checks. Do not infer current source status or event counts from historical rehearsals. A live reset requires the owner's explicit action/approval and is never a deployment step.

The project owner controls event membership, upstream credentials, production release, backups, retention, and incident decisions. Designated operator/contact and retention deadlines must be recorded before handover; this repository does not invent them.

## Access model

`/` is public. `/controller` retains the existing Supabase email/password authentication and event-17135 membership. MATCH, GROW, check-in increments, eligible undo, check-in status, and history require `staff` or `admin`. Settings reads, sync start/stop, confirmed Manual Mode, registration override, exact check-in total, meeting target, and critical reset require `admin`. A staff membership alone cannot invoke those privileged operations.

`controller-submit` and `dashboard-data` retain platform JWT verification and `@supabase/server` user verification. The Edge Function checks current `event_memberships`, using database-managed roles rather than user-editable metadata. Privileged RPCs check membership again using the authenticated actor supplied by the Edge Function. Failed membership lookups return generic access-unavailable responses. Browser roles cannot execute these mutation RPCs directly.

`public-dashboard-data` retains `verify_jwt=false` and `auth:none` for fixed-event aggregate GET only. Its selected-column queries, runtime validation, and safe output contract exclude identities, ratings, action history, sync error text, and credentials. The public function reads private source metadata only to choose display labeling. `dashboard-data` retains the same display payload for viewer/staff/admin members.

## Database permissions and public updates

RLS is enabled on exposed application tables. Browser roles cannot write application data, read raw meeting/feedback/audit/sync records, decrypt Vault secrets, or access the private synchronization/control tables. `controller_operations`, `controller_reversals`, `meet_checkin_control`, and synchronization tables remain private. Service-only RPC grants are explicit; the principal transactional mutations use `SECURITY INVOKER` with an empty search path.

The deployed migration grants anonymous SELECT of `dashboard_aggregates` under an RLS policy restricted to `event_id=17135`. This table contains only aggregate counts and freshness timestamps, permitting the requested public Realtime subscription through the existing aggregate publication. It contains no staff or participant identifiers. Anonymous writes remain denied. The browser still refetches through the validated public function on subscription/reconnection and uses its 15-second fallback. Private `event_settings` and control rows do not become anonymously readable.

New administrative actions, exact corrections, increments, reversals, and ordinary meeting/rating submissions share an event-row lock and request-ID collision guard. Retrying the same action and payload returns its existing record; reuse across operation kinds is rejected. Exact totals and settings also require a matching configuration version. Database constraints/capacity checks prohibit negative or fractional counts and attendance above effective registration. A registration override is stored independently from raw API snapshots and remains effective on later API publications; an incompatible API check-in count causes a failed sync without overwriting the display.

Manual Mode is a confirmed, one-way transition for the operating session. The database rejects return-to-API reconciliation and new sync starts in manual mode. Stop, failure, manual activation, and reset advance a generation and fence older work. Dispatch bodies carry their generation; delayed queued requests cannot claim a later session. Each completed publication checks generation, enabled state, mode, and lease transactionally. No frontend-only flag can authorize an API overwrite.

## Scheduler and worker credential boundary

The deployed server scheduler uses hosted `pg_cron` and `pg_net`. A guarded database dispatcher sends the fixed project/function URL with `x-b2match-worker-secret` from Vault secret `nh_b2match_worker_secret`. The Edge Function compares it with server-only `B2MATCH_WORKER_SECRET` before creating its privileged SDK context. Worker requests must include a nonnegative safe-integer generation. The public publishable key and staff JWT do not authorize worker requests. The former named `automations` API key is not used by this implementation.

`event_private` is not exposed to browser roles. The dispatcher/readiness helpers have narrowly granted service execution; the tick/watchdog is reserved for its database owner/Cron. Its `SECURITY DEFINER` functions use an empty search path and fixed event/destination. Vault decryption, Cron ownership, the private schema, and `net` internals must remain restricted to trusted operators. `pg_net` temporarily stores resolved headers in its internal request queue; never query/export/log those headers. Cron enqueue success is not proof of API success: the watcher checks dispatch errors and lease expiry and stops the session on failure.

The administrator's Start action persists enabled state and dispatches the first fetch immediately after transaction commit. The next due time is 30 seconds from each claimed start under the October 29 hosted cadence migration; a 10-second scheduler wake-up may add dispatch delay. The lease prevents overlapping fetches, so a slow pull can delay the next start. Any API, pagination, timeout, network, or publication failure disables further work and records a safe message/status. There are no API retries, automatic restarts, or browser synchronization timers.

To rotate the dedicated worker secret, stop synchronization, provision matching Edge/Vault values using a value-free secret-handling path, verify their match without printing values, and confirm an unauthorized request is rejected. Keep synchronization stopped until the owner/operator explicitly starts it. Never rotate project-wide keys or change unrelated infrastructure as a workaround.

## Secrets, origins, and response handling

Only `VITE_SUPABASE_URL`, the publishable key, and public application configuration may enter the browser bundle. `B2MATCH_API_KEY`, `B2MATCH_WORKER_SECRET`, Supabase secret/service-role credentials, and verifier invocation keys stay server-side. Do not place secrets in Git, `VITE_*`, command arguments/history, logs, screenshots, clipboard, or tool output. `.env.example` contains placeholders only.

The B2Match host/path is fixed HTTPS, native TLS verification remains enabled, and redirects are rejected before forwarding Bearer authorization. Every page is validated and fetched once. Participant IDs/check-in histories exist only in worker memory; PostgreSQL stores aggregate snapshots and safe run metadata. Application code does not log request headers, participant responses, or upstream bodies. Failures include safe classifications and available HTTP status, never sensitive response content.

`DASHBOARD_ALLOWED_ORIGINS` remains an exact allowlist. The public reader retains the exact production `https://horizonsevent.pages.dev` origin; approved loopback origins support local work. CORS responses do not grant authorization. Requests without Origin still require the protected endpoint's user/worker/verifier authentication. Public aggregate GET intentionally works without login. Platform JWT failures can occur before function CORS code.

`verify-b2match` remains separate, read-only, and non-publishing. It requires named Supabase key `b2match_verification`, the disabled-by-default `B2MATCH_DRY_RUN_ENABLED` gate, the event-ID guard, and the B2Match secret. It has no database write path or browser CORS. It uses the same parser/counting rules and single-attempt failure policy as the worker. A completed traversal proves neither portal parity nor provider quota permission. No real verifier request is part of mock testing or deployment.

## Critical reset and audit integrity

The reset is one authenticated admin-only backend transaction. The UI requires a separate confirmation view and exact phrase `RESET EVENT`; merely opening Settings or the dialog does nothing. The backend independently requires the phrase, version and explicit `scope:"match_grow"`. Cached reset requests without this scope are rejected at both the Edge boundary and SQL operation. Its confirmation states: "This will reset MATCH completed meetings and GROW ratings to zero. MEET registration/check-in totals will remain unchanged. This action cannot be undone through the controller."

Reset clears effective MATCH meetings and GROW feedback count/rating sum, marks old meeting/feedback actions cleared, and preserves historical records/audit. Old MATCH/GROW Undo and request replays cannot restore cleared values. It preserves MEET counts, registration overrides, manual session/baseline, check-in actions/Undo, source, synchronization flags/generation/leases and freshness timestamps, as well as MATCH target, accounts and unrelated settings/events. Only the shared control version advances. An empty rating set yields a null average, not a fabricated zero-star rating. Manual mode, if already entered, remains permanent. The reset itself appears in Action History and cannot be reversed through the controller.

Reset tests must use isolated synthetic data. Production data must not be reset by automated release or smoke tests without explicit owner approval and a separately reviewed recovery plan. Backups/recovery availability must be verified; preserving audit is not a substitute for backups.

## Historical credential-handling findings

These dated incidents are historical evidence, not current configuration claims:

- October 22: automatic approval review rejected an all-key `--reveal` command as broader than the named verifier request. It was not run. The Supabase Dashboard tester then auto-populated the default secret into an observed header field; the field was cleared and no request sent. Treat the transcript as sensitive and have the owner assess coordinated rotation. Do not repeat the default-key shortcut.
- October 24: `supabase projects api-keys` without `--reveal` unexpectedly emitted legacy `anon` and `service_role` JWT values in a tool transcript while masking newer named keys. Values were not added to this repository. Avoid that CLI listing for inventory until its behavior is understood. Do not reproduce values. Project-wide rotation requires an inventory of all consumers and a coordinated cutover; it must not be performed blindly.
- A separate automatic approval review rejected copying the named verifier secret to the system clipboard. The secret was not copied. Do not bypass a rejected credential retrieval through another route. Use a narrowly scoped method that keeps values out of observations, source, and logs.

The previous `rls_auto_enable` browser EXECUTE finding was addressed by the versioned grant-restriction migration while preserving the DDL trigger. Current grant/advisor results belong in the deployment evidence. Historical tests do not establish the security of later schema releases.

## Incident and retention procedure

On API failure, leave synchronization Failed/Stopped and preserve the last valid totals. Diagnose safe status/progress only. If fallback is needed, an admin confirms Manual Mode and operators use audited controller actions. Do not automatically recover or restore API mode. On a suspected credential incident, stop synchronization, preserve safe evidence, restrict affected access, notify the designated owner, and coordinate rotation with dependent services. Do not expose the credential while gathering evidence.

The owner must confirm retention/deletion periods for snapshots, sync logs, staff action records, and Auth accounts, plus backup/recovery ownership and a session revocation procedure. Do not delete audit records during event operation or assume deleting an account invalidates its existing tokens. Rehearse authorization denial, direct-write denial, reconnect, stale data, and isolated reset before release. See [testing](../testing/TEST_STRATEGY.md) and [operations](../operations/EVENT_DAY_RUNBOOK.md).

## Startup map boundary

`/map` continues to bundle the existing aggregate-only workbook JSON and approved assets. This task changes neither route nor map data. No participant rows, names, contacts, or identifiers belong in the bundle. The historical aggregate-only `map_dashboard_snapshots` table remains subject to its existing public-read/private-write policy. Its retirement or alteration requires a separate reviewed change.
