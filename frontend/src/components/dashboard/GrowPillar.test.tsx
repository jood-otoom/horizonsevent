import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GrowMetrics } from "../../types/dashboard";
import GrowPillar from "./GrowPillar";

describe("GrowPillar", () => {
  it("shows an honest empty state when no feedback has been submitted", () => {
    const metrics: GrowMetrics = {
      dataMode: "mock",
      status: "mock",
      averageRating: null,
      maximumRating: 5,
      feedbackCount: 0,
    };
    const markup = renderToStaticMarkup(<GrowPillar metrics={metrics} />);

    expect(markup).toContain("No feedback yet");
    expect(markup).toContain("Awaiting ratings");
    expect(markup).not.toContain("NaN");
  });

  it("labels the rating percentage against the five-point maximum", () => {
    const metrics: GrowMetrics = {
      dataMode: "live", status: "live", averageRating: 4,
      maximumRating: 5, feedbackCount: 3,
    };
    const markup = renderToStaticMarkup(<GrowPillar metrics={metrics} />);

    expect(markup).toContain("80%");
    expect(markup).toContain("of Maximum Rating");
    expect(markup).not.toContain("Target Achieved");
  });
});
