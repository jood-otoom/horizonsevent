import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GrowMetrics } from "../../types/dashboard";
import GrowPillar from "./GrowPillar";

describe("GrowPillar", () => {
  it("shows numeric zero values when no feedback has been submitted", () => {
    const metrics: GrowMetrics = {
      dataMode: "mock",
      status: "mock",
      averageRating: null,
      maximumRating: 5,
      feedbackCount: 0,
    };
    const markup = renderToStaticMarkup(<GrowPillar metrics={metrics} />);

    expect(markup).toContain('aria-label="0 feedback submissions; displayed rating 0 out of 5.0"');
    expect(markup).toContain('class="gauge-label">of 5.0</span>');
    expect(markup).toContain('class="metric-value">');
    expect(markup).toContain('>0%</span>');
    expect(markup).toContain("Feedback received");
    expect(markup).toContain("Rating Achieved");
    expect(markup).not.toMatch(/No feedback yet|Awaiting ratings|Data pending|NaN|undefined|—/);
  });

  it.each([
    { feedbackCount: null, averageRating: null },
    { feedbackCount: undefined, averageRating: Number.NaN },
    { feedbackCount: 0, averageRating: 4.4 },
    { feedbackCount: 3, averageRating: null },
  ])("does not present missing or invalid feedback as a confirmed zero: %o", (input) => {
    const metrics = {
      dataMode: "live", status: "pending", maximumRating: 5, ...input,
    } as unknown as GrowMetrics;
    const markup = renderToStaticMarkup(<GrowPillar metrics={metrics} />);

    expect(markup).toContain('aria-label="Meeting feedback unavailable"');
    expect(markup).toContain('class="gauge-label">Unavailable</span>');
    expect(markup).not.toMatch(/NaN|undefined|>0%<\/span>/);
    if (input.feedbackCount === 3) expect(markup).toContain('>3</span>');
  });

  it("uses real averages and computes the percentage against five", () => {
    const metrics: GrowMetrics = {
      dataMode: "live", status: "live", averageRating: 4.4,
      maximumRating: 5, feedbackCount: 3,
    };
    const markup = renderToStaticMarkup(<GrowPillar metrics={metrics} />);

    expect(markup).toContain('aria-label="3 feedback submissions; displayed rating 4.4 out of 5.0"');
    expect(markup).toContain('>88%</span>');
    expect(markup).toContain("Rating Achieved");
    expect(markup).not.toContain("Target Achieved");
  });

  it("marks a retained rating as stale", () => {
    const markup = renderToStaticMarkup(<GrowPillar metrics={{
      dataMode: "live", status: "stale", averageRating: 3,
      maximumRating: 5, feedbackCount: 1,
    }} />);
    expect(markup).toContain('class="gauge-label">of 5.0 · Stale</span>');
    expect(markup).toContain('>60%</span>');
  });
});
