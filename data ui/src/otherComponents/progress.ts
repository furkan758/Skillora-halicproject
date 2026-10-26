// Visual indicators use whole percentages; source scores keep their full precision.
export function progressPercentage(value: number, maximum = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(100, (value / maximum) * 100)));
}
