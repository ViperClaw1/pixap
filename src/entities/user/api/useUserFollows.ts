import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import { patchAuthorFollowInAllFeedCaches } from "@/entities/post/lib/postFeedCachePatch";
import { queryKeys, USER_FOLLOWS_QUERY_KEY } from "@/shared/api/queryKeys";

export { USER_FOLLOWS_QUERY_KEY };

export function useMyFollowing() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.userFollows.mine(user?.id ?? null),
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{ following_id: string }>).map((row) => row.following_id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
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
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", followingId);
        if (error) throw error;
        return { skipped: false as const, nowFollowing: false };
      }

      const { error } = await supabase
        .from("user_follows")
        .upsert({
          follower_id: user.id,
          following_id: followingId,
        });
      if (error) throw error;
      return { skipped: false as const, nowFollowing: true };
    },
    onSuccess: (result, variables) => {
      if (result.skipped) return;

      const mineKey = queryKeys.userFollows.mine(user?.id ?? null);
      queryClient.setQueryData<string[]>(mineKey, (prev = []) => {
        const set = new Set(prev);
        if (variables.isFollowing) {
          set.delete(variables.followingId);
        } else {
          set.add(variables.followingId);
        }
        return Array.from(set);
      });
      patchAuthorFollowInAllFeedCaches(queryClient, variables.followingId, result.nowFollowing);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.socialMetrics(user?.id ?? null) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.suggestionsPrefix });
    },
  });
}
