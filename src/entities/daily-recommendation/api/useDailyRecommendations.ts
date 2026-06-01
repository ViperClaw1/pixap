import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { localizeBusinessCard } from "@/entities/business-card";
import type { DailyRecommendation } from "../model/types";

type RpcRow = {
  venue_id: string;
  generated_rank: number;
  recommendation_score: number;
  recommendation_reasons: string[] | null;
  name: string;
  description: string | null;
  tags: string[] | null;
  images: string[] | null;
  city: string | null;
  rating: number | null;
};

export function useDailyRecommendations(targetDate?: string) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = i18n.language;
  const date = targetDate ?? new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: queryKeys.dailyRecommendations.today(user?.id, date, language),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DailyRecommendation[]> => {
      const { data, error } = await supabase.rpc("get_daily_recommendations", {
        p_date: date,
      });
      if (error) throw error;

      return ((data ?? []) as RpcRow[]).map((row) => {
        const localized = localizeBusinessCard(
          {
            name: row.name,
            description: row.description,
            tags: row.tags,
          },
          language,
        );
        return {
          venue_id: row.venue_id,
          generated_rank: Number(row.generated_rank ?? 0),
          recommendation_score: Number(row.recommendation_score ?? 0),
          recommendation_reasons: row.recommendation_reasons ?? [],
          name: localized.name,
          description: localized.description ?? "",
          tags: localized.tags ?? [],
          images: row.images ?? [],
          city: row.city,
          rating: Number(row.rating ?? 0),
        };
      });
    },
  });
}
