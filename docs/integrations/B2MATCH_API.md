# B2Match integration

The application reads event `17135` through the fixed server-side `https://api.b2match.com/public/participants` endpoint. The B2Match token stays in Supabase Edge secrets. The frontend never calls the external API, receives credentials, or ingests participant-level data.

The October 28 worker/verifier source is deployed for manually started server-side synchronization every 120 seconds. Read-only downloads of `sync-b2match` v28 and `verify-b2match` v30 matched their complete returned local source/configuration files, including the shared parser. Read-only SQL confirmed `pg_cron` 1.6.4, `pg_net` 0.20.4, the guarded 10-second scheduler job, Stopped API mode, and zero runs/leases. Deployment status, secret provisioning, frontend verification, and bundle hashes are recorded in [the deployment guide](../deployment/DEPLOYMENT.md). No real B2Match invocation was made in this verification. Automatic synchronization must remain stopped during deployment and testing; deployed source is not evidence of a successful live pull.

## Verified contract and historical evidence

The established request uses Bearer authorization, `event_id=17135`, `limit=50`, and opaque `page` tokens. Redirects are rejected to prevent credential forwarding. Response validation requires participant IDs/event/status/check-in structure and pagination totals, page size, page labels, and explicit tokens. Stable IDs may be safe integers or nonempty, unpadded strings.

On October 16, an owner-approved read-only pull completed five pages: 203 raw/unique participants, 202 registered, one canceled, zero event-entrance check-ins. The owner confirmed portal parity and authorized a one-time 202/0 publication. Those figures are historical, not current event counts. An October 21 older-parser verifier observed 244 raw/unique records, 230 registered, 14 canceled, zero checked in; current portal parity was not established. A subsequent stricter pull failed on an exact empty terminal token after 200 accepted records and published nothing. The guarded terminal-token repair was deployed to both functions; no later live compatibility result is asserted here. Review the latest release evidence before relying on current integration behavior.

## Counting rules — preserved

- Deduplicate by stable participant ID. Conflicting versions of the same ID reject the pull.
- Count status `registered`; exclude `canceled`. Any other status prevents publication. `validated` and `visible` are not registration filters.
- Count a registered participant once if any check-in has `type=check_in`, `locationType=event`, and `locationId=17135`. This is **ever checked in**; a later check-out does not erase attendance.
- Agenda-location scans do not count. A check-in at another event entrance requires review and prevents publication.
- Rate is `round(checkedIn / registered * 100)`. Zero registration is published only after a complete, validated empty traversal.

The October 28 change does not alter endpoint, field mappings, canceled-registration rules, check-in semantics, or deduplication.

## Complete pagination

Every pull traverses all pages. It rejects missing/malformed tokens, oversized pages, repeated nonempty page labels, repeated tokens, empty intermediate pages, changing totals, raw count above total, incomplete terminal pages, wrong events, and conflicting IDs. An empty first-page `currentPage` is accepted, matching an observed API response; opaque tokens remain the loop guard.

An exact empty `nextPageToken` is terminal only when raw count equals an unchanged reported total, the final page is shorter than 50, and unique participant count equals raw count. This is a conservative, previously approved inference; official documentation does not guarantee empty-token semantics. The existing null-terminal policy is retained. Partial results never leave the client as publishable counts. The cap remains 100 pages, 120 seconds overall, and 12 seconds per HTTP request. These limits can fail safely when volume grows; they are not registration limits.

No incremental `updated_since` query is used because registration-answer changes and removals need complete reconciliation. The server keeps only aggregate snapshots and safe progress logs, not participant records.

## Start, schedule, stop, and failure

An administrator starts through authenticated `controller-submit`. The database checks role/version, persists running state, and dispatches immediately through `pg_net`. The `pg_cron` dispatcher checks the durable due time for subsequent 120-second starts. At most one worker may own the event lease. The controller tab can close without stopping server scheduling.

Worker calls use a dedicated random `B2MATCH_WORKER_SECRET` matched to Vault `nh_b2match_worker_secret`, sent as `x-b2match-worker-secret`. This is separate from public browser keys and Supabase service-role credentials. The old environment sync flag no longer controls start/stop or source labels; durable database state is authoritative. The event-ID environment guard remains fixed at 17135.

Each API page gets one attempt. **Any** HTTP failure (including 429, 401/403, 5xx), network error, timeout, invalid JSON/contract, incomplete pagination, or publication failure stops the synchronization session. There is no retry, recovery, or automatic restart. Safe classifications, HTTP status where available, attempt/success timestamps, and progress are persisted. Detailed response bodies, headers, tokens, and participant data are not logged or displayed.

Stop preserves the last complete snapshot and increments the database generation. Every dispatch carries its generation, and the worker requires it before claiming work; a delayed queued request from before Stop cannot start work in a later session. Completion checks the generation, lease, enabled state, and source under a transaction lock, so an already-running fetch cannot publish after stop. The scheduler also checks dispatch responses and expired leases: a crashed worker becomes Failed rather than another API attempt. Registration overrides can cause an API publication conflict if API attendance exceeds the effective registration count; that failure also stops and preserves existing values.

## Manual fallback

Manual Mode is a confirmed, one-way transition for the event operating session. It stops scheduling and fences old API work. Start Sync is rejected on the backend thereafter. The main Check-ins Controller stays below MATCH/GROW and supports +1/+2/+5/+10 and administrator exact totals; exact changes use version checks and all increments are atomic/idempotent. Admin registration overrides remain separate from raw API totals. No API/manual reconciliation or return-to-API control is available.

The public dashboard continues to show effective aggregate values and the existing source/freshness representation. It never shows technical integration errors. Private Settings shows timestamps in Asia/Amman, raw last API counts, effective totals, current source, and the safe failure message. Neither API failure nor intentional stop converts unknown values to zero.

## Operational limits and remaining verification

The owner requests the 120-second cadence for October 29. Official B2Match quota/permission and new-registration/check-in propagation latency must be confirmed with the provider or authoritative event access; do not infer them from a successful API call. At the historical five-page size, a run would make five requests with this no-retry policy. Actual page volume can change.

Before the operator starts a live session, confirm current portal/API parity, real entrance scan semantics, B2Match quota, Supabase scheduler/worker support, and the latest production rehearsal results. Mock tests verify failure paths without deliberately rate-limiting B2Match. The critical reset must be tested against isolated data only and must never run on live event counters without explicit owner approval. See [API contracts](../backend/API_CONTRACTS.md), [event runbook](../operations/EVENT_DAY_RUNBOOK.md), and [test strategy](../testing/TEST_STRATEGY.md).
