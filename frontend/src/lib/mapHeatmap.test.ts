import { describe, expect, it } from "vitest";
import { createHeatmapScale } from "./mapHeatmap";

describe("governorate heatmap", () => {
  it("uses the complete distribution, preserves ties, and orders shades by count", () => {
    const scale = createHeatmapScale([84, 46, 44, 38, 23, 14, 14, 3]);
    expect(scale.colorFor(3)).toBe(scale.colorFor(14));
    expect(scale.colorFor(84)).not.toBe(scale.colorFor(3));
    const brightness = [3, 14, 23, 38, 44, 46, 84].map(total => {
      const color = scale.colorFor(total)!;
      const red = parseInt(color.slice(1, 3), 16);
      const green = parseInt(color.slice(3, 5), 16);
      const blue = parseInt(color.slice(5, 7), 16);
      return .2126 * red + .7152 * green + .0722 * blue;
    });
    expect(brightness).toEqual([...brightness].sort((a, b) => b - a));
  });

  it("keeps missing values neutral and handles an equal-value distribution", () => {
    const empty = createHeatmapScale([]);
    expect(empty.colorFor(undefined)).toBeNull();
    expect(empty.colorFor(12)).toBeNull();
    const equal = createHeatmapScale([12, 12, 12]);
    expect(equal.colorFor(12)).toMatch(/^#[0-9A-F]{6}$/);
    expect(equal.colorFor(0)).toBeNull();
  });
});
