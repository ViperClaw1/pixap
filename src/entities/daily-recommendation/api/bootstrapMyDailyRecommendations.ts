import { supabase } from "@/shared/api/supabase/client";
import { devWarn } from "@/shared/lib/devLog";

export type BootstrapMyDailyRecommendationsResult = {
  inserted_count: number;
  push_enqueued: boolean;
  generated_for_date: string;
};

export type BootstrapMyDailyRecommendationsOptions = {
  force?: boolean;
};

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Generates daily picks for the signed-in user and enqueues a push notification.
 * Uses the same SQL pipeline as the cron batch, but does not touch
 * `recommendation_generation_runs` (cron schedule/behavior unchanged).
 */
export async function bootstrapMyDailyRecommendations(
  dateYmd: string = todayUtcYmd(),
  options?: BootstrapMyDailyRecommendationsOptions,
): Promise<BootstrapMyDailyRecommendationsResult | null> {
  const params = options?.force ? { p_date: dateYmd, p_force: true } : { p_date: dateYmd };
  const { data, error } = await supabase.rpc("bootstrap_my_daily_recommendations" as never, params as never);

  if (error) {
    if (__DEV__) {
      devWarn("[daily-recs] bootstrap_my_daily_recommendations failed", error.message);
    }
    return null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  return {
    inserted_count: Number(row.inserted_count ?? 0),
    push_enqueued: Boolean(row.push_enqueued),
    generated_for_date: String(row.generated_for_date ?? dateYmd),
  };
}
