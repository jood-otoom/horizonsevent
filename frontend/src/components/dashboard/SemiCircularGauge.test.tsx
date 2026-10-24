import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SemiCircularGauge from "./SemiCircularGauge";

describe("SemiCircularGauge", () => {
  function marker(markup: string) {
    const element = markup.match(/<circle[^>]*class="gauge-indicator"[^>]*>/)?.[0];
    if (!element) throw new Error("Gauge marker is missing.");
    const x = Number(element.match(/\bcx="([^"]+)"/)?.[1]);
    const y = Number(element.match(/\bcy="([^"]+)"/)?.[1]);
    return { x, y };
  }

  it("renders a dynamic SVG gauge with an accessible metric label", () => {
    const markup = renderToStaticMarkup(
      <SemiCircularGauge
        value={4.4}
        maxValue={5}
        displayValue="4.4"
        label="of 5.0"
        ariaLabel="Average feedback rating 4.4 out of 5.0"
      />,
    );

    expect(markup).toContain('data-progress="88"');
    expect(markup).toContain('aria-label="Average feedback rating 4.4 out of 5.0"');
    expect(markup).toContain('stroke-dasharray="88 100"');
  });

  it("does not draw a progress dot for zero or invalid maximum values", () => {
    for (const [value, maxValue] of [[0, 202], [7, 0]]) {
      const markup = renderToStaticMarkup(
        <SemiCircularGauge value={value} maxValue={maxValue} displayValue="0" label="Checked In" />,
      );

      expect(markup).toContain('data-progress="0"');
      expect(markup).toContain('stroke="var(--display-track)"');
      expect(markup).not.toContain("gauge-indicator");
      expect(markup).not.toContain("gauge-progress");
      expect(markup).not.toContain("NaN");
    }
  });

  it("places small and 80-percent markers on the shared SVG arc", () => {
    for (const progress of [0.75, 80]) {
      const markup = renderToStaticMarkup(<SemiCircularGauge
        value={progress} maxValue={100} displayValue={String(progress)} label="Progress" />);
      const point = marker(markup);
      const angle = Math.PI * progress / 100;
      expect(point.x).toBeCloseTo(200 - 184 * Math.cos(angle), 8);
      expect(point.y).toBeCloseTo(200 - 184 * Math.sin(angle), 8);
      expect(Math.hypot(point.x - 200, point.y - 200)).toBeCloseTo(184, 8);
      expect(markup).toContain(`stroke-dasharray="${progress} 100"`);
    }
  });
});
