import type {
  ControllerStats,
  ControllerAction,
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
  submitMeeting(request: MeetingSubmissionRequest): Promise<MeetingSubmissionResponse>;
  submitFeedback(request: FeedbackSubmissionRequest): Promise<FeedbackSubmissionResponse>;
  undoAction(request: UndoRequest): Promise<UndoResponse>;
}
