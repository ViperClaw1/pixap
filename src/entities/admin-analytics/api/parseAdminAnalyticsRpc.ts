import type {
  AdminAnalyticsSnapshot,
  AnalyticsPeriod,
  DauAnalytics,
  MetricSummary,
  SubscriptionAnalytics,
  TimeSeriesPoint,
  WaCampaignAnalytics,
  WaOutcomeCounts,
  WaOutcomeKey,
} from "../model/types";

type RpcSeriesPoint = { date?: string; value?: number };
type RpcOutcomes = Partial<Record<WaOutcomeKey, number>>;

type AdminAnalyticsRpcRow = {
  period?: number;
  period_from?: string;
  period_to?: string;
  registrations?: {
    total?: number;
    growth_pct?: number;
    series?: RpcSeriesPoint[];
  };
  dau?: {
    today?: number;
    avg_7d?: number;
    vs_previous_pct?: number;
    series?: RpcSeriesPoint[];
  };
  whatsapp?: {
    campaigns_started?: number;
    successful_bookings?: number;
    conversion_pct?: number;
    success_rate_pct?: number;
    outcomes?: RpcOutcomes;
  };
  subscriptions?: {
    total_purchased?: number;
    growth_pct?: number;
    purchases_series?: RpcSeriesPoint[];
    mrr_series?: RpcSeriesPoint[];
    mrr_current?: number;
    revenue_ios?: number;
    revenue_android?: number;
  };
};

function parseSeries(raw: RpcSeriesPoint[] | undefined): TimeSeriesPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => typeof p.date === "string")
    .map((p) => ({
      date: p.date as string,
      value: typeof p.value === "number" && Number.isFinite(p.value) ? Math.round(p.value) : 0,
    }));
}

function parseOutcomes(raw: RpcOutcomes | undefined): WaOutcomeCounts {
  const keys: WaOutcomeKey[] = ["success", "missing_whatsapp", "venue_rejection", "other"];
  const out = {} as WaOutcomeCounts;
  for (const k of keys) {
    const v = raw?.[k];
    out[k] = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
  }
  return out;
}

function parseRegistrations(row: AdminAnalyticsRpcRow["registrations"]): MetricSummary {
  return {
    total: row?.total ?? 0,
    growthPct: row?.growth_pct ?? 0,
    series: parseSeries(row?.series),
  };
}

function parseDau(row: AdminAnalyticsRpcRow["dau"]): DauAnalytics {
  return {
    today: row?.today ?? 0,
    avg7d: row?.avg_7d ?? 0,
    vsPreviousPct: row?.vs_previous_pct ?? 0,
    series: parseSeries(row?.series),
  };
}

function parseWhatsapp(row: AdminAnalyticsRpcRow["whatsapp"]): WaCampaignAnalytics {
  const started = row?.campaigns_started ?? 0;
  const success = row?.successful_bookings ?? 0;
  const conv = row?.conversion_pct ?? row?.success_rate_pct ?? (started > 0 ? (success / started) * 100 : 0);
  return {
    campaignsStarted: started,
    successfulBookings: success,
    conversionPct: conv,
    successRatePct: row?.success_rate_pct ?? conv,
    outcomes: parseOutcomes(row?.outcomes),
  };
}

function parseSubscriptions(row: AdminAnalyticsRpcRow["subscriptions"]): SubscriptionAnalytics {
  return {
    totalPurchased: row?.total_purchased ?? 0,
    growthPct: row?.growth_pct ?? 0,
    purchasesSeries: parseSeries(row?.purchases_series),
    mrrSeries: parseSeries(row?.mrr_series),
    mrrCurrent: row?.mrr_current ?? 0,
    revenueIos: row?.revenue_ios ?? 0,
    revenueAndroid: row?.revenue_android ?? 0,
  };
}

export function parseAdminAnalyticsRpc(
  raw: unknown,
  requestedPeriod: AnalyticsPeriod,
): AdminAnalyticsSnapshot {
  const row = (raw ?? {}) as AdminAnalyticsRpcRow;
  const period = (row.period === 7 || row.period === 30 || row.period === 90
    ? row.period
    : requestedPeriod) as AnalyticsPeriod;

  return {
    period,
    periodFrom: row.period_from ?? "",
    periodTo: row.period_to ?? "",
    isMock: false,
    registrations: parseRegistrations(row.registrations),
    dau: parseDau(row.dau),
    whatsapp: parseWhatsapp(row.whatsapp),
    subscriptions: parseSubscriptions(row.subscriptions),
  };
}
