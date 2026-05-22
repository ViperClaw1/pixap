import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Json } from "@/shared/api/supabase/types";
import { localizeBusinessCard } from "@/entities/business-card";
import {
  hasOnboardingVenuePreferences,
  toOnboardingVenuesRpcPrefs,
  type OnboardingVenuePreferences,
} from "../lib/onboardingVenuePreferences";
import type { OnboardingVenue } from "../model/types";

type RpcRow = {
  venue_id: string;
  name: string;
  description: string;
  tags: string[] | null;
  images: string[] | null;
  city: string | null;
  category_name: string | null;
  match_score: number;
  rating: number;
};

const PAGE_SIZE = 8;

export function useRecommendedOnboardingVenues(
  offset: number,
  preferences: OnboardingVenuePreferences,
  prefsFingerprint: string,
  enabled = true,
) {
  const canQuery = enabled && hasOnboardingVenuePreferences(preferences);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useQuery({
    queryKey: queryKeys.onboardingVenues.page(offset, prefsFingerprint, language),
    enabled: canQuery,
    staleTime: 0,
    queryFn: async (): Promise<OnboardingVenue[]> => {
      const { data, error } = await supabase.rpc("get_recommended_onboarding_venues", {
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_prefs: toOnboardingVenuesRpcPrefs(preferences) as Json,
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
        name: localized.name,
        description: localized.description,
        tags: localized.tags,
        images: row.images ?? [],
        city: row.city,
        category_name: row.category_name ?? "",
        match_score: Number(row.match_score ?? 0),
        rating: Number(row.rating ?? 0),
      };
      });
    },
  });
}
