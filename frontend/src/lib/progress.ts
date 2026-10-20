export function calculateProgressPercent(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }

  const clamped = Math.min(100, Math.max(0, (value / maxValue) * 100));
  return Number(clamped.toFixed(8));
}

export function formatPercent(value: number, maxValue: number, decimals: 0 | 2 = 0): string {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return "—";
  }

  return `${Number(calculateProgressPercent(value, maxValue).toFixed(decimals))}%`;
}
