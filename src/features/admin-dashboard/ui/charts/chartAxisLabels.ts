import type { AnalyticsPeriod, TimeSeriesPoint } from "@/entities/admin-analytics";

/** How many x-axis labels to show for a given period length. */
export function chartAxisLabelStep(pointCount: number, period?: AnalyticsPeriod): number {
  if (period === 7 || pointCount <= 8) return 1;
  if (period === 30 || pointCount <= 31) return 5;
  if (period === 90 || pointCount > 31) return 10;
  if (pointCount <= 14) return 2;
  if (pointCount <= 31) return 5;
  return 10;
}

/** Compact date for chart x-axis (avoids overlap on 30/90 day ranges). */
export function formatCompactAxisDate(isoDate: string, pointCount: number): string {
  const month = isoDate.slice(5, 7);
  const day = isoDate.slice(8, 10);
  if (pointCount <= 14) {
    return `${month}/${day}`;
  }
  if (pointCount <= 31) {
    return String(parseInt(day, 10));
  }
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
}

export function buildLineChartData(
  points: TimeSeriesPoint[],
  period?: AnalyticsPeriod,
): { value: number; label: string }[] {
  const n = points.length;
  const step = chartAxisLabelStep(n, period);
  return points.map((p, i) => {
    const show = i === 0 || i === n - 1 || i % step === 0;
    return {
      value: p.value,
      label: show ? formatCompactAxisDate(p.date, n) : "",
    };
  });
}
