import { describe, expect, it } from "vitest";
import { createHeatmapScale } from "./mapHeatmap";

describe("governorate heatmap", () => {
  it("uses the complete distribution, preserves ties, and orders shades by count", () => {
    const scale = createHeatmapScale([84, 46, 44, 38, 22, 14, 14, 3]);
    expect(scale.colorFor(14)).toBe(createHeatmapScale([84, 46, 44, 38, 22, 14, 3]).colorFor(14));
    expect(scale.colorFor(3)).not.toBe(scale.colorFor(14));
    expect(scale.colorFor(84)).not.toBe(scale.colorFor(3));
    expect(scale.colorFor(84)).toBe("var(--map-heat-9)");
    expect(scale.colorFor(46)).toBe("var(--map-heat-8)");
    expect([3, 14, 22, 38, 44, 46, 84].map(total => Number(
      scale.colorFor(total)?.match(/map-heat-(\d)/)?.[1],
    ))).toEqual([1, 2, 4, 5, 6, 8, 9]);
  });

  it("keeps missing values neutral and handles an equal-value distribution", () => {
    const empty = createHeatmapScale([]);
    expect(empty.colorFor(undefined)).toBeNull();
    expect(empty.colorFor(12)).toBeNull();
    expect(empty.colorFor(0)).toBe("#FFFFFF");
    expect(createHeatmapScale([0, 3, 84]).colorFor(3)).toBe(createHeatmapScale([3, 84]).colorFor(3));
    const equal = createHeatmapScale([12, 12, 12]);
    expect(equal.colorFor(12)).toBe("var(--map-heat-9)");
    expect(equal.colorFor(0)).toBe("#FFFFFF");
  });
});
