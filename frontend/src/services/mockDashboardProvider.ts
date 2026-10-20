import type { GrowMetrics, MatchMetrics } from "../types/dashboard";

export interface MockDataProvider<T> {
  readonly dataMode: "mock";
  getMetrics(): T;
}

export const mockMeetingProvider: MockDataProvider<MatchMetrics> = {
  dataMode: "mock",
  getMetrics: () => ({
    dataMode: "mock",
    status: "mock",
    targetMeetings: 500,
    completedMeetings: 428,
  }),
};

export const mockFeedbackProvider: MockDataProvider<GrowMetrics> = {
  dataMode: "mock",
  getMetrics: () => ({
    dataMode: "mock",
    status: "mock",
    averageRating: 4.4,
    maximumRating: 5,
    feedbackCount: 38,
  }),
};
