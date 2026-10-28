// The map-only event palette moves from luminous pink to saturated burgundy.
const HEATMAP_COLORS = [
  "#FFF0F3", "#FFD6DF", "#FFB4C5", "#FF9CB2", "#FF8098",
  "#FF5A78", "#E91E49", "#C40032", "#9F0028",
] as const;

export interface HeatmapScale {
  colorFor: (total: number | undefined) => string | null;
}

// Group distinct workbook totals by rank, so ties always share a shade.
// The national distribution is supplied once; selection never changes the scale.
export function createHeatmapScale(totals: readonly number[]): HeatmapScale {
  const distinct = [...new Set(totals.filter(total => Number.isSafeInteger(total) && total > 0))]
    .sort((a, b) => a - b);
  const colors = new Map<number, string>();

  distinct.forEach((total, index) => {
    const colorIndex = distinct.length === 1
      ? HEATMAP_COLORS.length - 1
      : Math.round(index * (HEATMAP_COLORS.length - 1) / (distinct.length - 1));
    const color = HEATMAP_COLORS[colorIndex];
    colors.set(total, color);
  });

  return { colorFor: total => total === 0 ? "#FFFFFF" : total === undefined ? null : colors.get(total) ?? null };
}
