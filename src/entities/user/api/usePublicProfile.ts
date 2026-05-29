import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { PublicProfileItem } from "./usePublicProfiles";

export function usePublicProfile(userId: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.publicProfiles.byId(userId),
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PublicProfileItem> => {
      const { data, error } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username, bio")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as PublicProfileItem;
    },
  });
}
