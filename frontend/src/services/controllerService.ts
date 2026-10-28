import type {
  ControllerStats,
  ControllerAction,
  CheckinStatus,
  CheckinSubmissionResponse,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  MeetingSubmissionRequest,
  MeetingSubmissionResponse,
  UndoRequest,
  UndoResponse,
  CheckinQuantity,
  ControllerSettings,
  SettingsRequest,
  SettingsResponse,
} from "../types/controller";

export class ControllerConflictError extends Error {}

/** Demo and protected Supabase implementations share the same controller contract. */
export interface ControllerService {
  getStats(): Promise<ControllerStats>;
  getRecentActions(): Promise<ControllerAction[]>;
  getCheckins(): Promise<CheckinStatus>;
  submitMeeting(request: MeetingSubmissionRequest): Promise<MeetingSubmissionResponse>;
  submitFeedback(request: FeedbackSubmissionRequest): Promise<FeedbackSubmissionResponse>;
  submitCheckin(request: { requestId: string; quantity?: CheckinQuantity }): Promise<CheckinSubmissionResponse>;
  setCheckins(request: { requestId: string; checkedIn: number; expectedVersion: number }): Promise<CheckinSubmissionResponse>;
  getSettings(): Promise<ControllerSettings>;
  updateSettings(request: SettingsRequest): Promise<SettingsResponse>;
  undoAction(request: UndoRequest): Promise<UndoResponse>;
}
