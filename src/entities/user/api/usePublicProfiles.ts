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

export type PublicProfilesFilter = {
  /** When set, only profiles with this `account_role` (e.g. end users, not admins). */
  accountRole?: "user";
};

export const usePublicProfiles = (search: string, enabled = true, filter?: PublicProfilesFilter) => {
  const accountRoleKey = filter?.accountRole ?? "all";

  return useQuery({
    queryKey: queryKeys.publicProfiles.search(search.trim().toLowerCase(), accountRoleKey),
    queryFn: async () => {
      const value = search.trim();
      let query = supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username, bio")
        .limit(60);

      if (filter?.accountRole) {
        query = query.eq("account_role", filter.accountRole);
      }

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
