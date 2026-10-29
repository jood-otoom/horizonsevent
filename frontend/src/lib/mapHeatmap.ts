// Heat shades use the shared map CSS tokens so regions and cards follow one palette.
const HEATMAP_COLORS = [
  "var(--map-heat-1)", "var(--map-heat-2)", "var(--map-heat-3)",
  "var(--map-heat-4)", "var(--map-heat-5)", "var(--map-heat-6)",
  "var(--map-heat-7)", "var(--map-heat-8)", "var(--map-heat-9)",
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
