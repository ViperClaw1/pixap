import { supabase } from "@/shared/api/supabase/client";
import type { AdminAnalyticsProvider } from "./adminAnalyticsProvider";
import type { AnalyticsPeriod } from "../model/types";
import { parseAdminAnalyticsRpc } from "./parseAdminAnalyticsRpc";

export const supabaseAdminAnalyticsProvider: AdminAnalyticsProvider = {
  async fetchAdminAnalytics(period: AnalyticsPeriod) {
    const { data, error } = await supabase.rpc("admin_analytics_summary", {
      p_period_days: period,
    });

    if (error) {
      throw new Error(error.message);
    }

    return parseAdminAnalyticsRpc(data, period);
  },
};
