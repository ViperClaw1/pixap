import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PostItem, PostProfile, PostReactionType } from "@/types/posts";
import { useMyFollowing } from "@/entities/user";
import { normalizeBusinessCardImages } from "@/lib/businessCardImages";

type PostRow = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  created_at: string;
  geo_place_name: string | null;
  geo_formatted_address: string | null;
  geo_latitude: number | null;
  geo_longitude: number | null;
};

type PlaceRow = {
  id: string;
  name: string;
  images: unknown;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

export type FeedPostItem = PostItem & {
  place_name: string;
  business_card: {
    id: string;
    name: string;
    images: string[];
  } | null;
  comment_preview: Array<{ id: string; content: string; created_at: string }>;
  is_followed_author: boolean;
};

const FEED_PAGE_SIZE = 12;
const FETCH_WINDOW_MULTIPLIER = 4;

function isMissingGeoColumnsError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("geo_place_name") || normalized.includes("geo_formatted_address");
}

async function getInteractedPlaceIds(userId: string): Promise<string[]> {
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

export function usePostsFeed() {
  const { user } = useAuth();
  const { followingIds, followingSet } = useMyFollowing();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["posts", "feed", user?.id ?? null, page, followingIds.join(",")],
    queryFn: async () => {
      const fetchLimit = page * FEED_PAGE_SIZE * FETCH_WINDOW_MULTIPLIER;
      const interactedPlaceIds = user?.id ? await getInteractedPlaceIds(user.id) : [];

      const postsSelectWithGeo =
        "id, user_id, place_id, content, media_url, created_at, geo_place_name, geo_formatted_address, geo_latitude, geo_longitude";
      const postsSelectLegacy = "id, user_id, place_id, content, media_url, created_at";

      let postsQuery = await supabase
        .from("posts" as any)
        .select(postsSelectWithGeo)
        .order("created_at", { ascending: false })
        .limit(fetchLimit);
      if (postsQuery.error && isMissingGeoColumnsError(postsQuery.error.message)) {
        postsQuery = await supabase
          .from("posts" as any)
          .select(postsSelectLegacy)
          .order("created_at", { ascending: false })
          .limit(fetchLimit);
      }
      if (postsQuery.error) throw postsQuery.error;

      const posts = ((postsQuery.data ?? []) as Array<Partial<PostRow>>).map((row) => ({
        id: String(row.id ?? ""),
        user_id: String(row.user_id ?? ""),
        place_id: (row.place_id as string | null | undefined) ?? null,
        content: String(row.content ?? ""),
        media_url: (row.media_url as string | null | undefined) ?? null,
        created_at: String(row.created_at ?? ""),
        geo_place_name: (row.geo_place_name as string | null | undefined) ?? null,
        geo_formatted_address: (row.geo_formatted_address as string | null | undefined) ?? null,
        geo_latitude: (row.geo_latitude as number | null | undefined) ?? null,
        geo_longitude: (row.geo_longitude as number | null | undefined) ?? null,
      }));
      if (!posts.length) return { posts: [] as FeedPostItem[], hasMore: false };

      const postIds = posts.map((row) => row.id);
      const placeIds = Array.from(
        new Set(posts.map((row) => row.place_id).filter((id): id is string => Boolean(id))),
      );
      const userIds = Array.from(new Set(posts.map((row) => row.user_id)));

      const [{ data: placesData }, { data: profilesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] =
        await Promise.all([
          supabase.from("business_cards" as any).select("id, name, images").in("id", placeIds),
          supabase.from("public_profiles" as any).select("id, first_name, last_name, avatar_url, is_verified").in("id", userIds),
          supabase
            .from("post_comments" as any)
            .select("id, post_id, parent_id, content, created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: false }),
          supabase.from("post_reactions" as any).select("post_id, type").in("post_id", postIds),
          user?.id
            ? supabase.from("post_reactions" as any).select("post_id, type").eq("user_id", user.id).in("post_id", postIds)
            : Promise.resolve({ data: [] }),
        ]);

      const places = new Map<string, PlaceRow>(((placesData ?? []) as PlaceRow[]).map((row) => [row.id, row]));
      const profiles = new Map<string, PostProfile>(
        ((profilesData ?? []) as ProfileRow[]).map((row) => [
          row.id,
          {
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            avatar_url: row.avatar_url,
            is_verified: Boolean(row.is_verified),
          },
        ]),
      );

      const commentsByPost = new Map<string, Array<{ id: string; content: string; created_at: string }>>();
      const commentCountByPost = new Map<string, number>();
      for (const row of (commentsData ?? []) as Array<{ id: string; post_id: string; parent_id: string | null; content: string; created_at: string }>) {
        if (row.parent_id) continue;
        commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1);
        if (!commentsByPost.has(row.post_id)) commentsByPost.set(row.post_id, []);
        const existing = commentsByPost.get(row.post_id)!;
        if (existing.length < 2) existing.push({ id: row.id, content: row.content, created_at: row.created_at });
      }

      const reactionCountByPost = new Map<string, number>();
      for (const row of (reactionsData ?? []) as Array<{ post_id: string; type: PostReactionType }>) {
        if (row.type !== "like") continue;
        reactionCountByPost.set(row.post_id, (reactionCountByPost.get(row.post_id) ?? 0) + 1);
      }

      const myReactionByPost = new Map<string, PostReactionType>();
      for (const row of ((myReactionsResult as { data?: Array<{ post_id: string; type: PostReactionType }> }).data ?? []) as Array<{
        post_id: string;
        type: PostReactionType;
      }>) {
        myReactionByPost.set(row.post_id, row.type);
      }

      const interactedPlaceSet = new Set(interactedPlaceIds);
      const scored = posts.map((row) => {
        const placeKey = row.place_id ?? "";
        const score = followingSet.has(row.user_id)
          ? 0
          : placeKey && interactedPlaceSet.has(placeKey)
            ? 1
            : 2;
        const placeNameFromGeo =
          row.geo_place_name?.trim() || row.geo_formatted_address?.trim() || "Place";
        return {
          id: row.id,
          user_id: row.user_id,
          place_id: row.place_id,
          geo_place_name: row.geo_place_name,
          geo_formatted_address: row.geo_formatted_address,
          geo_latitude: row.geo_latitude,
          geo_longitude: row.geo_longitude,
          place_name: row.place_id ? (places.get(row.place_id)?.name ?? "Unknown place") : placeNameFromGeo,
          business_card: row.place_id
            ? places.get(row.place_id)
              ? {
                  id: places.get(row.place_id)!.id,
                  name: places.get(row.place_id)!.name,
                  images: normalizeBusinessCardImages(places.get(row.place_id)!.images),
                }
              : null
            : null,
          content: row.content,
          media_url: row.media_url,
          created_at: row.created_at,
          reaction_count: reactionCountByPost.get(row.id) ?? 0,
          comment_count: commentCountByPost.get(row.id) ?? 0,
          my_reaction: myReactionByPost.get(row.id) ?? null,
          profile: profiles.get(row.user_id) ?? null,
          comment_preview: commentsByPost.get(row.id) ?? [],
          is_followed_author: followingSet.has(row.user_id),
          score,
        };
      });

      scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const itemCount = page * FEED_PAGE_SIZE;
      return {
        posts: scored.slice(0, itemCount).map(({ score: _score, ...post }) => post),
        hasMore: posts.length >= fetchLimit,
      };
    },
  });

  return {
    ...query,
    posts: query.data?.posts ?? [],
    hasMore: query.data?.hasMore ?? false,
    loadMore: () => setPage((prev) => prev + 1),
    resetFeed: () => setPage(1),
  };
}
