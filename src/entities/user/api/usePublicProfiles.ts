import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export interface PublicProfileItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
  bio: string | null;
}

export const usePublicProfiles = (search: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.publicProfiles.search(search.trim().toLowerCase()),
    queryFn: async () => {
      const value = search.trim();
      let query = supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username, bio")
        .limit(60);

      if (value.length) {
        query = query.or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%,username.ilike.%${value}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PublicProfileItem[];
    },
    enabled,
    staleTime: 60 * 1000,
  });
};
