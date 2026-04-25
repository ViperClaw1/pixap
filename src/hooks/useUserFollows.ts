import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const USER_FOLLOWS_QUERY_KEY = "user_follows";

export function useMyFollowing() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [USER_FOLLOWS_QUERY_KEY, "mine", user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration is newer than generated types
        .from("user_follows" as any)
        .select("following_id")
        .eq("follower_id", user.id);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{ following_id: string }>).map((row) => row.following_id);
    },
    enabled: !!user?.id,
  });

  const followingSet = useMemo(() => new Set(query.data ?? []), [query.data]);

  return {
    ...query,
    followingIds: query.data ?? [],
    followingSet,
  };
}

export function useToggleFollow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followingId, isFollowing }: { followingId: string; isFollowing: boolean }) => {
      if (!user?.id) throw new Error("Authentication required");
      if (followingId === user.id) return { skipped: true as const };

      if (isFollowing) {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration is newer than generated types
          .from("user_follows" as any)
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", followingId);
        if (error) throw error;
        return { skipped: false as const, nowFollowing: false };
      }

      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration is newer than generated types
        .from("user_follows" as any)
        .insert({
          follower_id: user.id,
          following_id: followingId,
        });
      if (error) throw error;
      return { skipped: false as const, nowFollowing: true };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USER_FOLLOWS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
    },
  });
}
