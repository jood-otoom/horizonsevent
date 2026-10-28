export type Rating = 1 | 2 | 3 | 4 | 5;
export type CorrectionReason = "duplicate" | "wrong_count" | "wrong_rating" | "other";

export interface ControllerAction {
  requestId: string;
  kind: "meeting" | "feedback" | "checkin" | "settings";
  operation?: "submission" | "undo" | "reconcile" | "update_settings" | "reset_event" | "activate_manual" | "start_sync" | "stop_sync" | "set_checkins";
  quantity: 1 | 2 | 3 | 5 | 10 | null;
  rating: Rating | null;
  value?: number | null;
  originalRequestId?: string | null;
  createdAt: string;
  reversedAt: string | null;
  undoEligible?: boolean;
  label?: string;
}

export interface CheckinStatus {
  mode: "api" | "manual";
  registered: number | null;
  checkedIn: number | null;
  apiCheckedIn: number | null;
  apiAsOf: string | null;
  canReconcile: boolean;
  version?: number;
  source?: string;
  manualFallback?: boolean;
  canSetExact?: boolean;
}

export type CheckinQuantity = 1 | 2 | 5 | 10;

export interface ControllerSettings {
  role: "admin" | "staff";
  mode: "api" | "manual";
  syncState: "stopped" | "starting" | "running" | "syncing" | "failed" | "manual";
  syncEnabled: boolean;
  version: number;
  registered: number | null;
  checkedIn: number | null;
  source: string;
  registeredOverride: number | null;
  meetingTarget: number | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  nextSyncAt: string | null;
  apiRegistered: number | null;
  apiCheckedIn: number | null;
  error: string | null;
  httpStatus: number | null;
  canStart: boolean;
}

export type SettingsAction =
  | { kind: "start_sync" | "stop_sync" | "manual_mode" }
  | { kind: "update_settings"; registeredOverride?: number; meetingTarget?: number }
  | { kind: "reset_event"; confirmation: "RESET EVENT" };

export type SettingsRequest = SettingsAction & { requestId: string; expectedVersion: number };

export interface SettingsResponse {
  settings: ControllerSettings;
  checkins: CheckinStatus;
  record: { id: string; createdAt: string };
}

export interface CheckinSubmissionResponse {
  record: { id: string; createdAt: string };
  checkins: CheckinStatus;
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
