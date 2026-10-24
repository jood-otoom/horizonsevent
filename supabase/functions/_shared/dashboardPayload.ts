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

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function makeDashboardPayload(
  row: AggregateRow,
  settings: SettingsRow,
  now = Date.now(),
  sourceMode: "sync" | "snapshot" = "sync",
) {
  if (row.event_id !== 17135 || settings.event_id !== 17135 ||
      !validCount(row.completed_meetings) || !validCount(row.feedback_count) ||
      !validCount(row.rating_sum) || row.rating_sum < row.feedback_count ||
      row.rating_sum > row.feedback_count * 5 ||
      (settings.meeting_target !== null && !validCount(settings.meeting_target)) ||
      typeof settings.meet_verified !== "boolean" ||
      !Number.isSafeInteger(settings.max_meet_age_seconds) || settings.max_meet_age_seconds <= 0 ||
      (row.meet_failed_at !== null && !validTimestamp(row.meet_failed_at))) {
    throw new Error("invalid_aggregate");
  }
  const hasMeet = row.registered !== null && row.checked_in !== null &&
    row.check_in_rate !== null && row.last_successful_sync !== null;
  if (hasMeet) {
    if (!validCount(row.registered) || !validCount(row.checked_in) ||
        row.checked_in > row.registered || !validCount(row.check_in_rate) ||
        row.check_in_rate !== (row.registered === 0 ? 0 : Math.round(row.checked_in / row.registered * 100)) ||
        !validTimestamp(row.last_successful_sync)) throw new Error("invalid_meet");
  } else if (row.registered !== null || row.checked_in !== null ||
             row.check_in_rate !== null || row.last_successful_sync !== null) {
    throw new Error("invalid_meet");
  }
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
