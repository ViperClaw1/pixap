import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Json } from "@/shared/api/supabase/types";
import { parseUserPreferencesRow } from "../lib/parseUserPreferences";
import type { UserPreferences, UserPreferencesPatch } from "../model/types";

export function useUpsertUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: UserPreferencesPatch): Promise<UserPreferences> => {
      const { data, error } = await supabase.rpc("upsert_user_preferences", {
        p_patch: patch as Json,
      });
      if (error) throw error;
      return parseUserPreferencesRow(data as Record<string, unknown>);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userPreferences.mine(user?.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingVenues.prefix });
    },
  });
}
