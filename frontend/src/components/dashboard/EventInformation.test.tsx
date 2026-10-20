import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardMetrics } from "../../types/dashboard";
import EventInformation from "./EventInformation";

describe("EventInformation", () => {
  it("keeps a one-time MEET publication visibly distinct from connected staff metrics", () => {
    const metrics: DashboardMetrics = {
      dataMode: "live",
      meet: { status: "ready", data: {
        dataMode: "live", status: "snapshot", registered: 202,
        checkedIn: 0, checkInRate: 0, asOf: "2026-10-16T00:00:00Z",
      } },
      match: { dataMode: "live", status: "live", completedMeetings: 0, targetMeetings: 1200 },
      grow: { dataMode: "live", status: "live", feedbackCount: 0, averageRating: null, maximumRating: 5 },
    };
    const markup = renderToStaticMarkup(<EventInformation metrics={metrics} />);

    expect(markup).toContain("MEET portal-verified snapshot · No automatic updates");
    expect(markup).toContain("Published");
    expect(markup).toContain("MATCH connected · GROW connected");
    expect(markup).not.toContain("MEET verified live data");
  });
});
