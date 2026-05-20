import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

async function fetchInteractedPlaceIds(userId: string): Promise<string[]> {
  const [ownPostsResult, ownReactionsResult, ownCommentsResult] = await Promise.all([
    supabase.from("posts" as any).select("place_id").eq("user_id", userId).limit(300),
    supabase.from("post_reactions" as any).select("post_id").eq("user_id", userId).not("post_id", "is", null).limit(500),
    supabase.from("post_comments" as any).select("post_id").eq("user_id", userId).limit(500),
  ]);

  const ownPostPlaces = ((ownPostsResult.data ?? []) as Array<{ place_id: string | null }>)
    .map((row) => row.place_id)
    .filter((id): id is string => Boolean(id));
  const relatedPostIds = Array.from(
    new Set(
      [
        ...((ownReactionsResult.data ?? []) as Array<{ post_id: string | null }>).map((row) => row.post_id),
        ...((ownCommentsResult.data ?? []) as Array<{ post_id: string }>).map((row) => row.post_id),
      ].filter(Boolean) as string[],
    ),
  );

  if (!relatedPostIds.length) return Array.from(new Set(ownPostPlaces));

  const { data: relatedPosts } = await supabase.from("posts" as any).select("id, place_id").in("id", relatedPostIds);
  const placeIds = new Set(ownPostPlaces);
  for (const row of (relatedPosts ?? []) as Array<{ place_id: string | null }>) {
    if (row.place_id) placeIds.add(row.place_id);
  }
  return Array.from(placeIds);
}

/** Cached place affinity for feed scoring — avoids 3 extra queries on every feed page fetch. */
export function useInteractedPlaceIds(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.posts.interactedPlaces(userId ?? null),
    queryFn: () => fetchInteractedPlaceIds(userId!),
    enabled: Boolean(userId),
    staleTime: 8 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
