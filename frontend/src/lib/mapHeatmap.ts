// Sequential tints of the approved cream, primary red, and burgundy palette.
const HEATMAP_COLORS = ["#F5E6E4", "#E7C6CA", "#D49DA8", "#C66A80", "#AC0F2E", "#7A0019"] as const;

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
      ? Math.floor(HEATMAP_COLORS.length / 2)
      : Math.min(HEATMAP_COLORS.length - 1, Math.floor(index * HEATMAP_COLORS.length / distinct.length));
    const color = HEATMAP_COLORS[colorIndex];
    colors.set(total, color);
  });

  return { colorFor: total => total === 0 ? "#FFFFFF" : total === undefined ? null : colors.get(total) ?? null };
}
