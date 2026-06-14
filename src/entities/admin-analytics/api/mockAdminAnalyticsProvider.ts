import type { AdminAnalyticsProvider } from "./adminAnalyticsProvider";
import type {
  AdminAnalyticsSnapshot,
  AnalyticsPeriod,
  TimeSeriesPoint,
  WaOutcomeCounts,
} from "../model/types";
import { computePeriodDeltaPct } from "../lib/computePeriodDelta";

/** Deterministic pseudo-random from seed (stable mock per period). */
function seeded(seed: number, i: number): number {
  const x = Math.sin(seed * 9999 + i * 127) * 10000;
  return x - Math.floor(x);
}

function buildDateRange(days: number): string[] {
  const out: string[] = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildSeries(dates: string[], seed: number, base: number, variance: number): TimeSeriesPoint[] {
  return dates.map((date, i) => ({
    date,
    value: Math.max(0, Math.round(base + seeded(seed, i) * variance)),
  }));
}

function sumSeries(points: TimeSeriesPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}

function avgLast(points: TimeSeriesPoint[], n: number): number {
  const slice = points.slice(-n);
  if (slice.length === 0) return 0;
  return Math.round(sumSeries(slice) / slice.length);
}

const MOCK_MRR_PER_ACTIVE = 1299;

function buildWaOutcomes(seed: number, started: number): WaOutcomeCounts {
  const successRate = 0.42 + seeded(seed, 40) * 0.18;
  const missingRate = 0.12 + seeded(seed, 41) * 0.08;
  const rejectRate = 0.18 + seeded(seed, 42) * 0.1;
  const success = Math.round(started * successRate);
  const missing_whatsapp = Math.round(started * missingRate);
  const venue_rejection = Math.round(started * rejectRate);
  const other = Math.max(0, started - success - missing_whatsapp - venue_rejection);
  return { success, missing_whatsapp, venue_rejection, other };
}

async function fetchMock(period: AnalyticsPeriod): Promise<AdminAnalyticsSnapshot> {
  await new Promise((r) => setTimeout(r, 400));

  const dates = buildDateRange(period);
  const seed = period;
  const regSeries = buildSeries(dates, seed, 8 + period / 10, 12);
  const dauSeries = buildSeries(dates, seed + 1, 120 + period * 2, 45);
  const subSeries = buildSeries(dates, seed + 2, 2, 5);
  const mrrSeries = buildSeries(dates, seed + 3, 180, 40).map((p) => ({
    ...p,
    value: p.value * MOCK_MRR_PER_ACTIVE,
  }));

  const regTotal = sumSeries(regSeries);
  const prevRegTotal = Math.round(regTotal * (0.82 + seeded(seed, 50) * 0.15));
  const dauToday = dauSeries[dauSeries.length - 1]?.value ?? 0;
  const prevDauAvg = avgLast(
    buildSeries(buildDateRange(period), seed + 99, 100, 40),
    Math.min(7, period),
  );
  const waStarted = Math.round(period * (14 + seeded(seed, 60) * 8));
  const waOutcomes = buildWaOutcomes(seed, waStarted);
  const subTotal = sumSeries(subSeries);
  const prevSubTotal = Math.round(subTotal * 0.88);

  const periodTo = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const periodFrom = dates[0] ?? periodTo;

  return {
    period,
    periodFrom,
    periodTo,
    isMock: true,
    registrations: {
      total: regTotal,
      growthPct: computePeriodDeltaPct(regTotal, prevRegTotal),
      series: regSeries,
    },
    dau: {
      today: dauToday,
      avg7d: avgLast(dauSeries, Math.min(7, dauSeries.length)),
      vsPreviousPct: computePeriodDeltaPct(dauToday, prevDauAvg),
      series: dauSeries,
    },
    whatsapp: {
      campaignsStarted: waStarted,
      successfulBookings: waOutcomes.success,
      conversionPct:
        waStarted > 0 ? Math.round((waOutcomes.success / waStarted) * 1000) / 10 : 0,
      successRatePct:
        waStarted > 0 ? Math.round((waOutcomes.success / waStarted) * 1000) / 10 : 0,
      outcomes: waOutcomes,
    },
    subscriptions: {
      totalPurchased: subTotal,
      growthPct: computePeriodDeltaPct(subTotal, prevSubTotal),
      purchasesSeries: subSeries,
      mrrSeries,
      mrrCurrent: mrrSeries[mrrSeries.length - 1]?.value ?? 0,
      revenueIos: Math.round(subTotal * 0.62 * MOCK_MRR_PER_ACTIVE),
      revenueAndroid: Math.round(subTotal * 0.38 * MOCK_MRR_PER_ACTIVE),
    },
  };
}

export const mockAdminAnalyticsProvider: AdminAnalyticsProvider = {
  fetchAdminAnalytics: fetchMock,
};
