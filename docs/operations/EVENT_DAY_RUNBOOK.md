# Event-day operations

## Release and pre-event checks

This runbook describes the deployed function/schema implementation for October 29. Read-only source/configuration checks matched all five hosted functions to the local release; the scheduler job was confirmed. The older Stopped API mode and zero runs/leases observation is historical; the session was Running when the 30-second cadence migration was applied. Check [deployment evidence](../deployment/DEPLOYMENT.md) for the frontend release, secret provisioning, behavioral test results, current counters, and any blocker. Do not treat historical API snapshots as current attendance or source code as proof of deployment.

Before operators rely on it, open [the public dashboard](https://horizonsevent.pages.dev/) and [the controller](https://horizonsevent.pages.dev/controller). Confirm the correct event/project, equal effective MEET/MATCH/GROW values, current MATCH target, public accessibility, controller authentication, and admin Settings access. Confirm the Check-ins Controller expands without an availability error. Record the designated operator, owner/escalation contact, last trusted counts, and verified recovery options. Confirm the provider's permitted API cadence and current portal/API counting parity before the operator starts a live session.

Cadence deployment changes only the worker claim function; it does not require starting, stopping, or resetting the currently running session. Preserve production counters/GROW during smoke testing. The critical reset button must not be invoked on the live event during testing. Owner-approved isolated tests establish reset behavior; they do not clear production testing data.

## Settings and permissions

The gear in the Staff Controller header opens Settings. MATCH/GROW cards retain their existing controls, the expandable Check-ins Controller stays beneath them, and Action History remains below check-ins. Settings displays synchronization status, source, effective counts, last API counts, and fetch timestamps in **Asia/Amman** time.

Settings provides three section buttons: **Sync & attendance** for synchronization, retained API/effective totals, and manual fallback; **Dashboard settings** for the registered-participant override and MATCH target; and **Reset totals** for the protected reset. Select the required section rather than scrolling through every control. The header and section controls remain visible while the selected content scrolls. A compact status card keeps the current synchronization state clear, and **Stop Sync** is prominent in Sync & attendance. These section buttons change the displayed content only; selecting one does not mutate event data.

Production uses the existing single operator account, now approved as administrator. Sign in normally to use every controller feature; there is no role-management screen or additional account workflow. The backend retains its existing membership checks so these controls stay private.

## Start or stop B2Match synchronization

1. In Settings select **Sync & attendance** and review the current state and last successful API counts. **Start Sync** is available only in API mode with verified scheduler configuration. It is disabled permanently after Manual Mode is activated for this session.
2. Click **Start Sync** once. The server persists the session and fetches immediately. Subsequent starts are due 30 seconds from each claimed start, with up to 10 seconds of scheduler wake-up delay. An active worker blocks overlap, so a slow pull can delay the next start. The controller may be closed after the request is confirmed. It is not the scheduler.
3. Watch Starting/Syncing become Running and confirm a new successful timestamp and appropriate MEET totals. A complete API pull uses the established registration and event-entrance rules. It never derives completed meetings or ratings from B2Match.
4. To pause intentionally, click **Stop Sync** and wait for Stopped. Last valid values remain displayed. The database fences in-flight and delayed queued work, so old results cannot publish after stop. An administrator may explicitly start a new API session while still in API mode; there is no automatic restart.

If Start Sync is unavailable, do not substitute browser timers or change secrets casually. Check the release record and ask the designated owner to inspect scheduler readiness. If a Start/Stop response is uncertain, select **Refresh Settings** or reopen the dialog to read authoritative state; a newer status confirming the switch clears the pending control without another mutation. If the result remains uncertain, **Retry pending operation** preserves the original request ID and payload. Do not issue a different action until the pending result is resolved.

### Recovering a falsely pending Settings operation

An earlier browser defect expected check-in data in an administrative response that correctly contained only the saved record and Settings. It could report an error after a successful Start and leave Stop disabled. A browser error therefore does not prove synchronization stopped or that nothing was saved. The response parser correction and read-only status recovery address this frontend defect; see the release record for deployment and verification evidence.

Refresh or reopen Settings and review authoritative state. Settings requests stop waiting after 15 seconds and explain whether the read or mutation timed out; a timed-out mutation may already have completed. If Start/Stop is still marked uncertain after the status read, use **Retry pending operation** to safely replay the same request. When Running/Syncing is confirmed and a stop is needed, select **Stop Sync** and wait for Stopped. For registration, target, exact-total, manual-mode, or reset requests, retain the original retry request; do not create a new submission merely to clear a pending message. Escalate unresolved state to the owner. Never use the reset to recover a request error.

At the guarded October 29 stop-recovery checkpoint, the existing authorized `admin_event_operation` stopped synchronization with state `stopped`, `syncEnabled=false`, `nextSyncAt=null`, and version `10`. Transaction assertions preserved MEET `239` registered / `0` checked in, MATCH `10`, and GROW `2` submissions with rating sum `7`. These are historical recovery-checkpoint values, not a promise of current counts. This recovery did not reset totals or change schema, deployed backend functions, or authentication.

## Any API failure

A 429, authentication error, server/network error, timeout, malformed/incomplete response, or publication failure stops future synchronization. Settings shows Failed with a safe error and available HTTP status. The public display keeps its last valid counts and source/freshness indication; it never shows technical API details or converts failure to zero.

Do not repeatedly retry the provider or deliberately trigger rate limits. Check the last attempt/success timestamps and the last trusted count. An admin may choose the confirmed one-way fallback below. There is no automatic recovery. A read-only operator inspection of safe logs is appropriate; token values, response bodies, and `pg_net` request headers must not be displayed or exported.

## Activate Manual Mode

1. If API synchronization is active, stop it first and wait for Stopped. Failed is already stopped.
2. Compare the effective registered/check-in totals with the last trusted entrance count. In Settings → **Sync & attendance**, choose **Activate Manual Mode**, review the permanent-transition confirmation, and confirm deliberately.
3. Verify Manual Mode and manual fallback are shown. Start Sync is now unavailable for the rest of the operating session, including after refresh or another administrator signs in. API results cannot overwrite manual values. There is no return-to-API or reconciliation control.
4. Close Settings and expand the existing Check-ins Controller. It updates the same effective MEET totals shown publicly.

If counts are unknown, establish them with the designated owner before entering adjustments; do not assume zero. Registration can be corrected through the administrator override. The operator must avoid counting the same arrival twice.

## Manual check-in workflow

- Use **+1**, **+2**, **+5**, or **+10** for the number of newly verified check-ins missing from the displayed total. Each increment is stored atomically. Wait for saved confirmation; controls disable while processing.
- If a response is uncertain, use the offered retry. It reuses the request ID and cannot duplicate a successful adjustment. Reload/refetch authoritative state if instructed; never assume a network error means nothing was saved.
- An administrator can enter an exact checked-in total and select **Set exact total**. For example, entering 1,500 replaces the effective total with 1,500. It is not an increment. Empty, negative, decimal, over-capacity, and stale-version submissions are rejected. Refresh/review the latest value after a conflict before submitting again.
- Check-ins cannot exceed registered participants. Correct registration first when the larger attendance figure is verified. A registration override cannot be below existing check-ins; correct check-ins first when appropriate.
- Use Action History **Undo** for a specific eligible mistaken increment. Undo reverses that whole submission, including +5/+10. An exact correction establishes a new baseline; older increments cannot later subtract from it. Cleared meeting/feedback actions are not undoable; the MATCH/GROW reset leaves check-in actions and their existing Undo eligibility unchanged. Review the saved history and public value after correction.

If Supabase is unavailable, controller actions cannot persist. Keep a controlled offline entrance log and involve the owner when service returns. Use reviewed exact totals after reconnecting rather than replaying uncertain taps blindly. No client-only counter is authoritative.

## Registration override and meeting target

An administrator selects **Dashboard settings** in Settings, edits **Registered participants override** and/or **MATCH target meetings**, then selects **Save dashboard settings**. Review current values before saving. Counts must be nonnegative integers; the target must be positive. The registration override remains separate from the last API count and stays authoritative during subsequent API publications and Manual Mode. If API attendance exceeds that override, synchronization fails safely; review the correction before a new API session.

Changing MATCH target recalculates progress without altering completed meetings, meeting records, or ratings. A concurrent version conflict requires refresh and review. After saving, compare the controller with the public dashboard; Realtime refetch and the 15-second fallback should propagate changes. Do not edit database aggregates directly as a shortcut.

## Critical pre-event reset — owner/admin only

Use this only when the owner decides to clear MATCH/GROW testing data. It is never automatic. Preserve a reviewed baseline/recovery record first. In Settings select **Reset totals**, open **Reset MATCH & GROW Totals**, read the warning, and type **RESET EVENT** exactly. Opening the section or dialog does nothing; the separate confirmation executes one backend transaction. Never confirm the live reset as part of deployment, testing, or recovery from a pending-request message.

> This will reset MATCH completed meetings and GROW ratings to zero. MEET registration/check-in totals will remain unchanged. This action cannot be undone through the controller.

The reset sets completed meetings, feedback count, and rating sum to zero. GROW returns to its empty state with a **null average**, not a zero-star rating. Historical meeting/feedback records and audit remain retained, but their cleared contributions cannot return through old Undo or retried submissions. The MATCH target, event configuration, accounts, and unrelated events remain unchanged.

MEET registered/check-in counts and check-in rate, registration override, source/mode, manual session, API enabled/state and timestamps, snapshots, and check-in history/Undo are preserved. The operation does not start or stop API synchronization: whatever state was present before reset remains in effect. A reset is therefore not a substitute for **Stop Sync** or a manual-mode transition.

After an owner-executed reset, verify MATCH completed meetings and GROW feedback count are exactly zero on the controller and public display, and confirm the backend rating sum is zero with a null derived average. Compare MEET totals/rate, source/override/manual state, API state/timestamps, and target with the recorded baseline; any unrelated concurrent attendance update must be assessed separately rather than attributed to reset. Confirm the reset entry in Action History, retained meeting/feedback audit, and unchanged check-in Undo behavior. New meeting/rating submissions can then be recorded normally.

The controller sends the explicit reset scope `match_grow`. Older cached-client requests without that scope are rejected; reload the current controller rather than resubmitting an obsolete request or editing requests manually. Deployment evidence is recorded separately; changing this guidance does not establish that a new reset has been run.

## Monitoring, reconnect, and escalation

The public dashboard reads persisted aggregate values, subscribes to `dashboard_aggregates`, refetches on successful subscription/reconnection, and retains the 15-second fallback. A browser refresh never starts B2Match synchronization. If the public endpoint is unavailable, preserve the last display, inspect connection/freshness, and compare authoritative values after reconnect. If updates do not appear within the fallback window, inspect safe network/status information and escalate; do not repeatedly submit the same change using new IDs.

Confirm MATCH and GROW remain normal during attendance operations. Escalate unexplained counter differences, unauthorized access, failed persistence, scheduler failures, and suspected credential exposure to the designated owner. Do not delete records, rotate broad keys, alter Auth, or deploy ad hoc infrastructure during the event. Follow the reviewed release/rollback path and preserve audit evidence. Recovery from a failed release is a reviewed artifact rollback or forward repair, not a database reset.

## Scheduler details for maintainers

The fixed-event `pg_cron` job calls the guarded database tick every 10 seconds; idle Stopped/Failed/Manual states dispatch no API requests. The dispatcher uses Vault `nh_b2match_worker_secret`; the Edge worker checks matching `B2MATCH_WORKER_SECRET` on `x-b2match-worker-secret`. Never print either secret or inspect/export resolved request headers. Dispatch generation, a single lease, due-time checks, and publication fencing prevent overlap and stale publication. The watchdog stops on enqueue/request/lease failures; Cron enqueue success alone does not prove an API fetch succeeded. Use Settings, safe response metadata, sync run state, and aggregate freshness together.

## Startup map after the pending redesign release

The redesigned `/map` is a fixed workbook snapshot, not a live b2match or Supabase counter. Before the event, verify its source hash and 265-startup total against the reviewed `Map master` workbook, then check Aqaba 84, Amman 22, Ajloun 14 with 9/5 participant gender and 9/35 known employment, and one other region. Use Show all to restore the national view. A browser reload restores the national selection but does not refresh data from Excel; changing the workbook requires importer review, a new frontend build, and an approved release. Never use the former 266-row hosted map snapshot to "correct" the new view without a source audit.

The employee figures are known counts from column O, with two Amman records flagged missing in column X despite numeric zeros. Treat 142 employing startups and 762 employees as recorded values that can be incomplete until the source is resolved. The map uses a bundled 2006 boundary derivative, so confirm geographic acceptance and check label/pin legibility on the actual LED. If any card disagrees with the selected governorate or a region appears blank unexpectedly, revert to the approved prior frontend artifact after recording the failure; do not edit hosted data during the event as an ad hoc repair.
