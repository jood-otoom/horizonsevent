import type { Participant } from "./b2matchClient.ts";
import { B2matchSyncError } from "./b2matchClient.ts";

export interface MeetCounts {
  registered: number;
  checkedIn: number;
  checkInRate: number;
}

export function aggregateMeet(participants: readonly Participant[]): MeetCounts {
  let registered = 0;
  let checkedIn = 0;
  const seenIds = new Map<string, Participant>();
  for (const participant of participants) {
    const previous = seenIds.get(participant.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(participant)) throw new B2matchSyncError("conflicting_participant");
      continue;
    }
    seenIds.set(participant.id, participant);
    if (participant.status === "canceled") continue;
    if (participant.status !== "registered") {
      throw new B2matchSyncError("unknown_participant_status");
    }
    registered++;
    if (participant.checkIns.some((entry) =>
      entry.type === "check_in" &&
      entry.locationType === "event" &&
      entry.locationId === participant.eventId
    )) checkedIn++;
  }
  return {
    registered,
    checkedIn,
    checkInRate: registered === 0 ? 0 : Math.round((checkedIn / registered) * 100),
  };
}
