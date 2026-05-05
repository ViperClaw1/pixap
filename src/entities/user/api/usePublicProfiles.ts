import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";

export interface PublicProfileItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export const usePublicProfiles = (search: string) => {
  return useQuery({
    queryKey: ["public_profiles", "search", search.trim().toLowerCase()],
    queryFn: async () => {
      const value = search.trim();
      let query = supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url")
        .limit(60);

      if (value.length) {
        query = query.or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PublicProfileItem[];
    },
  });
};
