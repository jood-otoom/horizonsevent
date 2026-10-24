import type {
  ControllerStats,
  ControllerAction,
  CheckinStatus,
  CheckinSubmissionResponse,
  ReconcileCheckinsRequest,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  MeetingSubmissionRequest,
  MeetingSubmissionResponse,
  UndoRequest,
  UndoResponse,
} from "../types/controller";

/** Demo and protected Supabase implementations share the same controller contract. */
export interface ControllerService {
  getStats(): Promise<ControllerStats>;
  getRecentActions(): Promise<ControllerAction[]>;
  getCheckins(): Promise<CheckinStatus>;
  submitMeeting(request: MeetingSubmissionRequest): Promise<MeetingSubmissionResponse>;
  submitFeedback(request: FeedbackSubmissionRequest): Promise<FeedbackSubmissionResponse>;
  submitCheckin(request: { requestId: string }): Promise<CheckinSubmissionResponse>;
  reconcileCheckins(request: ReconcileCheckinsRequest): Promise<CheckinSubmissionResponse>;
  undoAction(request: UndoRequest): Promise<UndoResponse>;
}
