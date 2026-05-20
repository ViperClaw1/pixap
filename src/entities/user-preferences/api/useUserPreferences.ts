import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { parseUserPreferencesRow } from "../lib/parseUserPreferences";
import type { UserPreferences } from "../model/types";

export function useUserPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.userPreferences.mine(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<UserPreferences | null> => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return parseUserPreferencesRow(data as Record<string, unknown>);
    },
  });
}
