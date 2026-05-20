import { supabase } from "@/shared/api/supabase/client";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";
import type { PostProfile, PostReactionType } from "@/shared/model/types/posts";
import type { FeedPostItem } from "../api/usePostsFeed";

export type PostRowInput = {
  id: string;
  user_id: string;
  place_id: string | null;
  content: string;
  media_url: string | null;
  media_blurhashes?: unknown;
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

export function isMissingGeoColumnsError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("geo_place_name") || normalized.includes("geo_formatted_address");
}

export function isMissingMediaBlurhashesError(message?: string) {
  return (message ?? "").toLowerCase().includes("media_blurhashes");
}

export function normalizePostRow(row: Partial<PostRowInput>): PostRowInput {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    place_id: (row.place_id as string | null | undefined) ?? null,
    content: String(row.content ?? ""),
    media_url: (row.media_url as string | null | undefined) ?? null,
    media_blurhashes: row.media_blurhashes,
    created_at: String(row.created_at ?? ""),
    geo_place_name: (row.geo_place_name as string | null | undefined) ?? null,
    geo_formatted_address: (row.geo_formatted_address as string | null | undefined) ?? null,
    geo_latitude: (row.geo_latitude as number | null | undefined) ?? null,
    geo_longitude: (row.geo_longitude as number | null | undefined) ?? null,
  };
}

export async function hydrateFeedPosts(
  posts: PostRowInput[],
  options: { userId?: string; followingSet?: ReadonlySet<string> },
): Promise<FeedPostItem[]> {
  if (!posts.length) return [];

  const { userId, followingSet = new Set<string>() } = options;
  const postIds = posts.map((row) => row.id);
  const placeIds = Array.from(new Set(posts.map((row) => row.place_id).filter((id): id is string => Boolean(id))));
  const userIds = Array.from(new Set(posts.map((row) => row.user_id)));

  const [{ data: placesData }, { data: commentsData }, { data: reactionsData }, myReactionsResult] = await Promise.all([
    placeIds.length
      ? supabase.from("business_cards" as any).select("id, name, images").in("id", placeIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("post_comments" as any)
      .select("id, post_id, parent_id, content, created_at, user_id")
      .in("post_id", postIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(400, postIds.length * 8)),
    supabase.from("post_reactions" as any).select("post_id, type").in("post_id", postIds),
    userId
      ? supabase.from("post_reactions" as any).select("post_id, type").eq("user_id", userId).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const places = new Map<string, PlaceRow>(((placesData ?? []) as PlaceRow[]).map((row) => [row.id, row]));

  const commentsByPost = new Map<
    string,
    Array<{ id: string; content: string; created_at: string; user_id: string }>
  >();
  const commentCountByPost = new Map<string, number>();
  const commentAuthorIds = new Set<string>();
  for (const row of (commentsData ?? []) as Array<{
    id: string;
    post_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
    user_id: string;
  }>) {
    if (row.parent_id) continue;
    commentCountByPost.set(row.post_id, (commentCountByPost.get(row.post_id) ?? 0) + 1);
    if (!commentsByPost.has(row.post_id)) commentsByPost.set(row.post_id, []);
    const existing = commentsByPost.get(row.post_id)!;
    if (existing.length < 2) {
      commentAuthorIds.add(row.user_id);
      existing.push({
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        user_id: row.user_id,
      });
    }
  }

  const profileIds = Array.from(new Set([...userIds, ...commentAuthorIds]));
  let profilesRows: ProfileRow[] = [];
  if (profileIds.length) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("public_profiles" as any)
      .select("id, first_name, last_name, avatar_url, is_verified")
      .in("id", profileIds);
    if (profilesError) throw profilesError;
    profilesRows = (profilesData ?? []) as ProfileRow[];
  }

  const profiles = new Map<string, PostProfile>(
    profilesRows.map((row) => [
      row.id,
      {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        username: null,
        is_verified: Boolean(row.is_verified),
      },
    ]),
  );

  const commentPreviewByPost = new Map<
    string,
    Array<{ id: string; content: string; created_at: string; avatar_url: string | null }>
  >();
  for (const [postId, previews] of commentsByPost) {
    commentPreviewByPost.set(
      postId,
      previews.map((preview) => ({
        id: preview.id,
        content: preview.content,
        created_at: preview.created_at,
        avatar_url: profiles.get(preview.user_id)?.avatar_url ?? null,
      })),
    );
  }

  const reactionCountByPost = new Map<string, number>();
  for (const row of (reactionsData ?? []) as Array<{ post_id: string; type: PostReactionType }>) {
    if (row.type !== "like") continue;
    reactionCountByPost.set(row.post_id, (reactionCountByPost.get(row.post_id) ?? 0) + 1);
  }

  const myReactionByPost = new Map<string, PostReactionType>();
  for (const row of ((myReactionsResult as { data?: Array<{ post_id: string; type: PostReactionType }> }).data ??
    []) as Array<{ post_id: string; type: PostReactionType }>) {
    myReactionByPost.set(row.post_id, row.type);
  }

  return posts.map((row) => {
    const placeNameFromGeo = row.geo_place_name?.trim() || row.geo_formatted_address?.trim() || "Place";
    const placeCard = row.place_id ? places.get(row.place_id) : undefined;
    return {
      id: row.id,
      user_id: row.user_id,
      place_id: row.place_id,
      geo_place_name: row.geo_place_name,
      geo_formatted_address: row.geo_formatted_address,
      geo_latitude: row.geo_latitude,
      geo_longitude: row.geo_longitude,
      place_name: placeCard?.name ?? (row.place_id ? "Unknown place" : placeNameFromGeo),
      business_card: placeCard
        ? {
            id: placeCard.id,
            name: placeCard.name,
            images: normalizeBusinessCardImages(placeCard.images),
          }
        : null,
      content: row.content,
      media_url: row.media_url,
      media_blurhashes: parseMediaBlurhashesColumn(row.media_blurhashes),
      created_at: row.created_at,
      reaction_count: reactionCountByPost.get(row.id) ?? 0,
      comment_count: commentCountByPost.get(row.id) ?? 0,
      my_reaction: myReactionByPost.get(row.id) ?? null,
      profile: profiles.get(row.user_id) ?? null,
      comment_preview: commentPreviewByPost.get(row.id) ?? [],
      is_followed_author: followingSet.has(row.user_id),
    };
  });
}
