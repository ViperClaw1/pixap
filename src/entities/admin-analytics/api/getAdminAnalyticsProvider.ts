import type { AdminAnalyticsProvider } from "./adminAnalyticsProvider";
import { mockAdminAnalyticsProvider } from "./mockAdminAnalyticsProvider";
import { supabaseAdminAnalyticsProvider } from "./supabaseAdminAnalyticsProvider";

/**
 * Live metrics via RPC `admin_analytics_summary` (staff-only, server-checked).
 * Set EXPO_PUBLIC_ADMIN_ANALYTICS_USE_MOCK=true to force mock data (local dev without migration).
 */
export function getAdminAnalyticsProvider(): AdminAnalyticsProvider {
  if (process.env.EXPO_PUBLIC_ADMIN_ANALYTICS_USE_MOCK === "true") {
    return mockAdminAnalyticsProvider;
  }
  return supabaseAdminAnalyticsProvider;
}
