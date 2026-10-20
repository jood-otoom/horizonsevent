import { describe, expect, it } from "vitest";
import { calculateProgressPercent, formatPercent } from "./progress";

describe("calculateProgressPercent", () => {
  it("calculates decimal and integer progress", () => {
    expect(calculateProgressPercent(892, 1240)).toBeCloseTo(71.935, 2);
    expect(calculateProgressPercent(428, 500)).toBe(85.6);
    expect(calculateProgressPercent(4.4, 5)).toBe(88);
  });

  it("clamps progress into the 0 to 100 percent range", () => {
    expect(calculateProgressPercent(-2, 5)).toBe(0);
    expect(calculateProgressPercent(8, 5)).toBe(100);
  });

  it("handles zero, invalid, and non-finite maximum values safely", () => {
    expect(calculateProgressPercent(0, 5)).toBe(0);
    expect(calculateProgressPercent(3, 0)).toBe(0);
    expect(calculateProgressPercent(3, -1)).toBe(0);
    expect(calculateProgressPercent(Number.NaN, 5)).toBe(0);
    expect(calculateProgressPercent(3, Number.POSITIVE_INFINITY)).toBe(0);
    expect(formatPercent(3, 0)).toBe("—");
  });

  it("shows small real progress against the approved 1,200-meeting target", () => {
    expect(formatPercent(0, 1200, 2)).toBe("0%");
    expect(formatPercent(1, 1200, 2)).toBe("0.08%");
    expect(formatPercent(1199, 1200, 2)).toBe("99.92%");
    expect(formatPercent(1200, 1200, 2)).toBe("100%");
    expect(formatPercent(1, 1200)).toBe("0%");
  });
});
