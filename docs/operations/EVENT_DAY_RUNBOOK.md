# Event-day operations

## Current status

The emergency check-in path exists in local code only. Do not use it on the hosted event until the migration, controller Edge Function, frontend release, and non-production rehearsal are approved and completed. Automatic b2match publishing remains disabled. The current hosted MEET value is a previously approved static snapshot, not a live API feed.

## Staff check-in fallback after release

1. Check `/` and `/controller` for the same registered and checked-in values. Confirm the b2match portal or synchronization is unavailable or delayed, and record the last trusted count.
2. On `/controller`, open **Check-ins Controller**. For each entrance check-in missing from the displayed count, press **+1 Check-in** once. Wait for the saved confirmation before the next tap. If the response is uncertain, use **Retry +1 check-in**; it reuses the same request ID. Do not count a participant already reflected in the displayed total.
3. Keep the controller open to verify the effective count. Hiding it has no data effect. If a tap was mistaken, expand **Action History** and click **Undo** on that check-in; it reverses immediately. If the result is uncertain, use **Retry undo** on the same action. Reconciled-session actions cannot be undone; escalate instead.
4. If Supabase is unavailable, the button cannot save. Record entrance scans in a separate controlled offline log and reconcile them with the project owner after service returns. Do not assume a failed request was saved or enter an arbitrary total.

## API recovery

The latest raw API count appears beside the manual count only after a successful newer publishing sync. Manual mode remains authoritative until staff review the portal and choose **Review API count** then **Confirm verified API count**. A mismatch is expected while scans propagate; do not switch sources until the raw count is verified. The server rejects the switch if either count or snapshot timestamp changed during review. After switching, verify `/` and `/controller` agree, check the percentage, and confirm MATCH/GROW are unchanged. A subsequent manual +1 starts a new session.

## Monitoring and escalation

Watch for failed controller submissions and a raw API count that remains below or above the manually displayed count. In the current hosted frontend, the presentation does not show source freshness; check the stored timestamp and failure state through the operations data path. A pending local frontend correction adds compact "Snapshot" and "Stale" labels and shows unavailable GROW data without a false zero; these labels are not live until an approved frontend release. Browser reconnection triggers an authoritative `public-dashboard-data` refetch; the dashboard also polls every 15 seconds while mounted. If the public endpoint fails, retain the last displayed values as stale and compare them with the authenticated controller before acting. If the API returns a registration count below effective check-ins, publication fails and preserves the prior aggregate; investigate before retrying. Escalate any unexplained discrepancy to the owner. Do not change sync gates, deploy, alter targets, or delete audit rows during the event without the separate release and recovery approvals.

## Startup map after the pending redesign release

The redesigned `/map` is a fixed workbook snapshot, not a live b2match or Supabase counter. Before the event, verify its source hash and 265-startup total against the reviewed `Map master` workbook, then check Aqaba 84, Amman 22, Ajloun 14 with 9/5 participant gender and 9/35 known employment, and one other region. Use Show all to restore the national view. A browser reload restores the national selection but does not refresh data from Excel; changing the workbook requires importer review, a new frontend build, and an approved release. Never use the former 266-row hosted map snapshot to "correct" the new view without a source audit.

The employee figures are known counts from column O, with two Amman records flagged missing in column X despite numeric zeros. Treat 142 employing startups and 762 employees as recorded values that can be incomplete until the source is resolved. The map uses a bundled 2006 boundary derivative, so confirm geographic acceptance and check label/pin legibility on the actual LED. If any card disagrees with the selected governorate or a region appears blank unexpectedly, revert to the approved prior frontend artifact after recording the failure; do not edit hosted data during the event as an ad hoc repair.
