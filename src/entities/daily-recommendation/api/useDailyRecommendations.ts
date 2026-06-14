import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { localizeBusinessCard } from "@/entities/business-card";
import { useProfile } from "@/entities/user";
import { todayLocalYmd } from "@/shared/lib/localDate";
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
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const language = i18n.language;
  const date = targetDate ?? todayLocalYmd();
  const userCity = profile?.city?.trim() || null;
  const normalizedUserCity = userCity?.toLowerCase() ?? null;

  return useQuery({
    queryKey: queryKeys.dailyRecommendations.today(user?.id, date, language, normalizedUserCity),
    enabled: Boolean(user?.id) && !loading && !profileLoading,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => (user?.id ? previousData : undefined),
    queryFn: async (): Promise<DailyRecommendation[]> => {
      const { data, error } = await supabase.rpc("get_daily_recommendations", {
        p_date: date,
      });
      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const filteredRows = normalizedUserCity
        ? rows.filter((row) => {
            const rowCity = row.city?.trim();
            if (!rowCity) return true;
            return rowCity.toLowerCase() === normalizedUserCity;
          })
        : rows;

      return filteredRows.map((row) => {
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
