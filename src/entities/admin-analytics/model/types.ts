/** Analytics period selector (days). */
export type AnalyticsPeriod = 7 | 30 | 90;

export type TimeSeriesPoint = {
  date: string;
  value: number;
};

export type MetricSummary = {
  total: number;
  /** Percent change vs previous period of same length. */
  growthPct: number;
  series: TimeSeriesPoint[];
};

export type WaOutcomeKey =
  | "success"
  | "missing_whatsapp"
  | "venue_rejection"
  | "other";

export type WaOutcomeCounts = Record<WaOutcomeKey, number>;

export type WaCampaignAnalytics = {
  campaignsStarted: number;
  successfulBookings: number;
  conversionPct: number;
  successRatePct: number;
  outcomes: WaOutcomeCounts;
};

export type SubscriptionAnalytics = {
  totalPurchased: number;
  growthPct: number;
  purchasesSeries: TimeSeriesPoint[];
  /** Estimated MRR in minor currency units (e.g. cents) — mock until RPC. */
  mrrSeries: TimeSeriesPoint[];
  mrrCurrent: number;
  /** Estimated revenue in period from production IAP (cents), by platform. */
  revenueIos: number;
  revenueAndroid: number;
};

export type DauAnalytics = {
  today: number;
  avg7d: number;
  vsPreviousPct: number;
  series: TimeSeriesPoint[];
};

export type AdminAnalyticsSnapshot = {
  period: AnalyticsPeriod;
  periodFrom: string;
  periodTo: string;
  registrations: MetricSummary;
  dau: DauAnalytics;
  whatsapp: WaCampaignAnalytics;
  subscriptions: SubscriptionAnalytics;
  /** When true, data is from mock provider — show disclaimer in UI. */
  isMock: boolean;
};
