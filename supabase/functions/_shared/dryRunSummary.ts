import type { Participant } from "./b2matchClient.ts";
import { aggregateMeet, type MeetCounts } from "./meetAggregation.ts";

export interface DryRunDiagnostics {
  canceledParticipants: number;
  unexpectedStatusParticipants: number;
  otherEventEntranceCheckIns: number;
  agendaLocationCheckIns: number;
}

export interface DryRunSummary {
  status: "complete" | "needs_review";
  counts: MeetCounts | null;
  diagnostics: DryRunDiagnostics;
}

export function summarizeDryRun(participants: readonly Participant[], eventId: string): DryRunSummary {
  const diagnostics: DryRunDiagnostics = {
    canceledParticipants: 0,
    unexpectedStatusParticipants: 0,
    otherEventEntranceCheckIns: 0,
    agendaLocationCheckIns: 0,
  };
  for (const participant of participants) {
    if (participant.status === "canceled") diagnostics.canceledParticipants++;
    else if (participant.status !== "registered") diagnostics.unexpectedStatusParticipants++;
    for (const checkIn of participant.checkIns) {
      if (checkIn.type !== "check_in") continue;
      if (checkIn.locationType === "event" && checkIn.locationId !== eventId) {
        diagnostics.otherEventEntranceCheckIns++;
      } else if (checkIn.locationType === "location") {
        diagnostics.agendaLocationCheckIns++;
      }
    }
  }
  if (diagnostics.unexpectedStatusParticipants > 0 || diagnostics.otherEventEntranceCheckIns > 0) {
    return { status: "needs_review", counts: null, diagnostics };
  }
  return {
    status: "complete",
    counts: aggregateMeet(participants),
    diagnostics,
  };
}
