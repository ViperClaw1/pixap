import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyFollowing } from "./useUserFollows";
import { useProfile } from "./useProfile";

type PublicProfileWithBio = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  username: string | null;
  bio: string | null;
};

type FollowRelation = {
  follower_id: string;
  following_id: string;
};

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "this",
  "that",
  "from",
  "you",
  "your",
  "как",
  "для",
  "это",
  "что",
  "или",
  "the",
]);

function extractKeywords(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-zа-я0-9_]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  );
}

export function useProfileSocialMetrics() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profile", "social-metrics", user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) {
        return {
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        };
      }

      const [postsCountResult, followersCountResult, followingCountResult] = await Promise.all([
        supabase
          .from("posts" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("user_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", user.id),
        supabase
          .from("user_follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", user.id),
      ]);

      if (postsCountResult.error) throw postsCountResult.error;
      if (followersCountResult.error) throw followersCountResult.error;
      if (followingCountResult.error) throw followingCountResult.error;

      return {
        postsCount: postsCountResult.count ?? 0,
        followersCount: followersCountResult.count ?? 0,
        followingCount: followingCountResult.count ?? 0,
      };
    },
    enabled: !!user?.id,
  });

  return {
    ...query,
    postsCount: query.data?.postsCount ?? 0,
    followersCount: query.data?.followersCount ?? 0,
    followingCount: query.data?.followingCount ?? 0,
  };
}

export function useSuggestedProfiles(limit = 10) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { followingSet, followingIds } = useMyFollowing();

  const query = useQuery({
    queryKey: ["profile", "suggestions", user?.id ?? null, limit, followingIds.join(","), profile?.bio ?? ""],
    queryFn: async () => {
      if (!user?.id) return [] as Array<PublicProfileWithBio & { mutualCount: number; reason: string }>;

      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username, bio")
        .limit(120);
      if (profilesError) throw profilesError;

      const allProfiles = (profilesData ?? []) as PublicProfileWithBio[];
      const candidateProfiles = allProfiles.filter((item) => item.id !== user.id && !followingSet.has(item.id));
      if (!candidateProfiles.length) return [];

      const candidateIds = candidateProfiles.map((item) => item.id);
      let mutualRows: FollowRelation[] = [];
      if (followingIds.length) {
        const { data: mutualData, error: mutualError } = await supabase
          .from("user_follows")
          .select("follower_id, following_id")
          .in("follower_id", followingIds)
          .in("following_id", candidateIds);
        if (mutualError) throw mutualError;
        mutualRows = (mutualData ?? []) as FollowRelation[];
      }

      const mutualCountByUser = new Map<string, number>();
      for (const row of mutualRows) {
        mutualCountByUser.set(row.following_id, (mutualCountByUser.get(row.following_id) ?? 0) + 1);
      }

      const myKeywords = new Set(extractKeywords(profile?.bio));
      const scored = candidateProfiles.map((item) => {
        const mutualCount = mutualCountByUser.get(item.id) ?? 0;
        const candidateKeywords = extractKeywords(item.bio);
        const keywordOverlap = candidateKeywords.reduce((acc, token) => acc + (myKeywords.has(token) ? 1 : 0), 0);
        const isKeywordSuggested = keywordOverlap > 0;
        return {
          ...item,
          mutualCount,
          keywordOverlap,
          isKeywordSuggested,
          reason: mutualCount > 0 ? `${mutualCount} mutuals` : isKeywordSuggested ? "Suggested to you" : "",
        };
      });

      const relevant = scored.filter((item) => item.mutualCount > 0 || item.isKeywordSuggested);

      relevant.sort((a, b) => {
        if (a.mutualCount !== b.mutualCount) return b.mutualCount - a.mutualCount;
        if (a.keywordOverlap !== b.keywordOverlap) return b.keywordOverlap - a.keywordOverlap;
        return (a.first_name ?? "").localeCompare(b.first_name ?? "");
      });

      return relevant.slice(0, limit);
    },
    enabled: !!user?.id,
  });

  const suggestions = useMemo(() => query.data ?? [], [query.data]);
  return {
    ...query,
    suggestions,
  };
}
