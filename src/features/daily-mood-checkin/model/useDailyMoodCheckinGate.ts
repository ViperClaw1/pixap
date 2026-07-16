import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { bootstrapMyDailyRecommendations } from "@/entities/daily-recommendation";
import {
  getMyDailyMoodCheckin,
  skipMyDailyMoodCheckin,
  upsertMyDailyMoodCheckin,
  type DailyMoodCheckinInput,
} from "@/entities/daily-mood-checkin";
import { queryKeys } from "@/shared/api/queryKeys";
import { todayLocalYmd } from "@/shared/lib/localDate";

export function useDailyMoodCheckinGate(enabled = true) {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const dateYmd = todayLocalYmd();

  const query = useQuery({
    queryKey: queryKeys.dailyMoodCheckin.today(user?.id, dateYmd),
    queryFn: () => getMyDailyMoodCheckin(dateYmd),
    enabled: enabled && Boolean(user?.id) && !loading,
    staleTime: 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: async (input: Omit<DailyMoodCheckinInput, "dateYmd">) => {
      const saved = await upsertMyDailyMoodCheckin({ ...input, dateYmd });
      await bootstrapMyDailyRecommendations(dateYmd, {
        force: true,
        moodTags: input.moodTags,
        energyLevel: input.energyLevel,
      });
      return saved;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyMoodCheckin.prefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => skipMyDailyMoodCheckin(dateYmd),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyMoodCheckin.prefix });
    },
  });

  const shouldPrompt = useMemo(
    () => enabled && Boolean(user?.id) && query.isFetched && !query.isError && !query.data,
    [enabled, query.data, query.isError, query.isFetched, user?.id],
  );

  return {
    dateYmd,
    shouldPrompt,
    isLoading: query.isLoading,
    isSaving: submitMutation.isPending || skipMutation.isPending,
    submit: submitMutation.mutateAsync,
    skip: skipMutation.mutateAsync,
  };
}
