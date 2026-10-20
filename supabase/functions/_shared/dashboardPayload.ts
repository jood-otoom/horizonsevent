export interface AggregateRow {
  event_id: number;
  registered: number | null;
  checked_in: number | null;
  check_in_rate: number | null;
  last_successful_sync: string | null;
  meet_failed_at: string | null;
  completed_meetings: number;
  feedback_count: number;
  rating_sum: number;
}

export interface SettingsRow {
  event_id: number;
  meeting_target: number | null;
  meet_verified: boolean;
  max_meet_age_seconds: number;
}

export function makeDashboardPayload(
  row: AggregateRow,
  settings: SettingsRow,
  now = Date.now(),
  sourceMode: "sync" | "snapshot" = "sync",
) {
  if (row.event_id !== 17135 || settings.event_id !== 17135) throw new Error("wrong_event");
  const hasMeet = row.registered !== null && row.checked_in !== null &&
    row.check_in_rate !== null && row.last_successful_sync !== null;
  const age = hasMeet ? now - Date.parse(row.last_successful_sync!) : Number.POSITIVE_INFINITY;
  const failedSince = hasMeet && row.meet_failed_at !== null &&
    Date.parse(row.meet_failed_at) > Date.parse(row.last_successful_sync!);
  const stale = !Number.isFinite(age) || age < 0 || age > settings.max_meet_age_seconds * 1000 || failedSince;
  const status = sourceMode === "snapshot" && settings.meet_verified ? "snapshot" :
    stale ? "stale" : settings.meet_verified ? "live" : "pending";
  const meet = hasMeet ? {
    registered: row.registered,
    checkedIn: row.checked_in,
    checkInRate: row.check_in_rate,
    ...(status === "snapshot"
      ? { publishedAt: row.last_successful_sync }
      : { lastSuccessfulSync: row.last_successful_sync }),
    verification: settings.meet_verified ? "approved" : "pending",
    status,
  } : null;
  return {
    eventId: 17135,
    meet,
    match: { completedMeetings: row.completed_meetings, targetMeetings: settings.meeting_target },
    grow: {
      feedbackCount: row.feedback_count,
      averageRating: row.feedback_count === 0 ? null : row.rating_sum / row.feedback_count,
    },
  };
}
