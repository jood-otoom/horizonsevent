const HEATMAP_COLORS = ["#FDE8ED", "#F7BAC8", "#F0859D", "#E54869", "#CF103A", "#980024"] as const;

export interface HeatmapScale {
  colorFor: (total: number | undefined) => string | null;
}

// Group distinct published totals by rank, so ties always share a shade.
// The full nationwide distribution is supplied once; selection never changes the scale.
export function createHeatmapScale(totals: readonly number[]): HeatmapScale {
  const distinct = [...new Set(totals.filter(total => Number.isSafeInteger(total) && total >= 0))]
    .sort((a, b) => a - b);
  const colors = new Map<number, string>();

  distinct.forEach((total, index) => {
    const colorIndex = distinct.length === 1
      ? Math.floor(HEATMAP_COLORS.length / 2)
      : Math.min(HEATMAP_COLORS.length - 1, Math.floor(index * HEATMAP_COLORS.length / distinct.length));
    const color = HEATMAP_COLORS[colorIndex];
    colors.set(total, color);
  });

  return { colorFor: total => total === undefined ? null : colors.get(total) ?? null };
}
