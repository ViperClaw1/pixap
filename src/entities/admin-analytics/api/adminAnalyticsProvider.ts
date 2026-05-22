import type { AdminAnalyticsSnapshot, AnalyticsPeriod } from "../model/types";

export interface AdminAnalyticsProvider {
  fetchAdminAnalytics(period: AnalyticsPeriod): Promise<AdminAnalyticsSnapshot>;
}

/**
 * Live data: `supabaseAdminAnalyticsProvider` → RPC `admin_analytics_summary`.
 * Server must verify `profiles.account_role = 'admin'` (see migration).
 * Never rely on client-only checks for sensitive aggregates.
 */
