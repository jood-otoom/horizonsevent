import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SemiCircularGauge from "./SemiCircularGauge";

describe("SemiCircularGauge", () => {
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
    const markup = renderToStaticMarkup(
      <SemiCircularGauge value={7} maxValue={0} displayValue="—" label="No data" />,
    );

    expect(markup).toContain('data-progress="0"');
    expect(markup).not.toContain("gauge-indicator");
    expect(markup).not.toContain("NaN");
  });
});
