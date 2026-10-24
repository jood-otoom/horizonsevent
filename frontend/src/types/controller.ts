export type Rating = 1 | 2 | 3 | 4 | 5;
export type CorrectionReason = "duplicate" | "wrong_count" | "wrong_rating" | "other";

export interface ControllerAction {
  requestId: string;
  kind: "meeting" | "feedback" | "checkin";
  operation?: "submission" | "undo" | "reconcile";
  quantity: 1 | 2 | 3 | null;
  rating: Rating | null;
  value?: number | null;
  originalRequestId?: string | null;
  createdAt: string;
  reversedAt: string | null;
  undoEligible?: boolean;
}

export interface CheckinStatus {
  mode: "api" | "manual";
  registered: number | null;
  checkedIn: number | null;
  apiCheckedIn: number | null;
  apiAsOf: string | null;
  canReconcile: boolean;
}

export interface CheckinSubmissionResponse {
  record: { id: string; createdAt: string };
  checkins: CheckinStatus;
}

export interface ReconcileCheckinsRequest {
  requestId: string;
  expectedManual: number;
  expectedApi: number;
  expectedApiAt: string;
}

export interface MeetingRecord {
  id: string;
  createdAt: string;
}

export interface FeedbackRecord {
  id: string;
  rating: Rating;
  createdAt: string;
}

export interface ControllerStats {
  dataMode: "mock" | "live";
  completedMeetings: number;
  feedbackCount: number;
  averageRating: number | null;
}

export interface MeetingSubmissionRequest {
  requestId: string;
  quantity?: 1 | 2 | 3;
}

export interface FeedbackSubmissionRequest {
  requestId: string;
  rating: Rating;
}

export interface MeetingSubmissionResponse {
  record: MeetingRecord;
  stats: ControllerStats;
}

export interface FeedbackSubmissionResponse {
  record: FeedbackRecord;
  stats: ControllerStats;
}

export interface UndoRequest {
  requestId: string;
  originalRequestId: string;
  reason: CorrectionReason;
}

export interface UndoResponse {
  reversal: { id: string; originalRequestId: string; createdAt: string };
  stats: ControllerStats;
}
