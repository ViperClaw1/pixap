import { supabase } from "@/shared/api/supabase/client";
import { devWarn } from "@/shared/lib/devLog";

export type BootstrapMyDailyRecommendationsResult = {
  inserted_count: number;
  push_enqueued: boolean;
  generated_for_date: string;
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
): Promise<BootstrapMyDailyRecommendationsResult | null> {
  const { data, error } = await supabase.rpc("bootstrap_my_daily_recommendations" as never, {
    p_date: dateYmd,
  } as never);

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
