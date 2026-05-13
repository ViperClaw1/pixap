import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export type FollowSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

export function usePeopleToFollow(search: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.messages.followSuggestions(user?.id ?? null, search.trim().toLowerCase()),
    queryFn: async () => {
      if (!user?.id) return [] as FollowSuggestion[];
      const value = search.trim();

      let request = supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- view is managed by SQL migrations
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .limit(80);

      if (value.length) {
        request = request.or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%,username.ilike.%${value}%`);
      }

      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as FollowSuggestion[];
    },
    enabled: !!user?.id,
  });

  const people = useMemo(
    () => (query.data ?? []).filter((candidate) => candidate.id !== user?.id),
    [query.data, user?.id],
  );

  return {
    ...query,
    people,
  };
}
