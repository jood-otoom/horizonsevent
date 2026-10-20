export type MetricResource<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export interface MeetMetrics {
  dataMode: "mock" | "live";
  status: "mock" | "live" | "pending" | "stale" | "snapshot";
  registered: number;
  checkedIn: number;
  checkInRate: number;
  asOf: string;
}

export interface MatchMetrics {
  dataMode: "mock" | "live";
  status: "mock" | "live" | "pending" | "stale";
  targetMeetings: number | null;
  completedMeetings: number | null;
}

export interface GrowMetrics {
  dataMode: "mock" | "live";
  status: "mock" | "live" | "pending" | "stale";
  averageRating: number | null;
  maximumRating: 5;
  feedbackCount: number | null;
}

export interface DashboardMetrics {
  dataMode: "mock" | "live";
  meet: MetricResource<MeetMetrics>;
  match: MatchMetrics;
  grow: GrowMetrics;
}
