import { supabase } from "@/shared/api/supabase/client";
import {
  enrichPostsBoostedAt,
  hydrateFeedPosts,
  isMissingBoostedAtError,
  isMissingGeoColumnsError,
  isMissingMediaBlurhashesError,
  normalizePostRow,
  type PostRowInput,
} from "@/entities/post/lib/hydrateFeedPosts";
import { FEED_PAGE_SIZE } from "../model/feedConstants";
import type { FeedPostItem } from "./usePostsFeed";

export type LegacyFeedPostsCursor = { createdAt: string; id: string };

export type LegacyFeedPostsPage = {
  posts: FeedPostItem[];
  hasMore: boolean;
  nextCursor: LegacyFeedPostsCursor | null;
};

const postsSelectLegacy = "id, user_id, place_id, content, media_url, created_at";
const postsSelectWithGeo =
  "id, user_id, place_id, content, media_url, created_at, geo_place_name, geo_formatted_address, geo_latitude, geo_longitude";
const postsSelectWithGeoAndBlur = `${postsSelectWithGeo}, media_blurhashes`;
const postsSelectWithBoost = `${postsSelectWithGeoAndBlur}, boosted_at`;

function applyCreatedAtIdCursor<T extends { or: (filters: string) => T }>(
  query: T,
  cursor: LegacyFeedPostsCursor | null,
): T {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  );
}

async function runPostsSelect(params: {
  select: string;
  cursor: LegacyFeedPostsCursor | null;
  limit: number;
  authorUserId?: string;
}): Promise<{
  rows: PostRowInput[];
  hasMore: boolean;
  nextCursor: LegacyFeedPostsCursor | null;
  selectIncludedBoostedAt: boolean;
}> {
  const { select, cursor, limit, authorUserId } = params;
  const fetchLimit = limit + 1;

  const exec = () => {
    let q = supabase.from("posts" as any).select(select);
    if (authorUserId) q = q.eq("user_id", authorUserId);
    q = applyCreatedAtIdCursor(q, cursor);
    return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
  };

  let selectIncludedBoostedAt = select.includes("boosted_at");
  let postsQuery = await exec();
  if (postsQuery.error && isMissingBoostedAtError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    const fallbackSelect = select.includes("media_blurhashes")
      ? postsSelectWithGeoAndBlur
      : select.includes("geo_place_name")
        ? postsSelectWithGeo
        : postsSelectLegacy;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(fallbackSelect);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  }
  if (postsQuery.error && isMissingGeoColumnsError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(postsSelectLegacy);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  } else if (postsQuery.error && isMissingMediaBlurhashesError(postsQuery.error.message)) {
    selectIncludedBoostedAt = false;
    postsQuery = await (() => {
      let q = supabase.from("posts" as any).select(postsSelectWithGeo);
      if (authorUserId) q = q.eq("user_id", authorUserId);
      q = applyCreatedAtIdCursor(q, cursor);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(fetchLimit);
    })();
  }
  if (postsQuery.error) throw postsQuery.error;

  const rawRows = (postsQuery.data ?? []) as Array<Record<string, unknown>>;
  const hasMore = rawRows.length > limit;
  const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
  let rows = pageRows.map((row) => normalizePostRow(row));
  if (!selectIncludedBoostedAt && rows.length) {
    rows = await enrichPostsBoostedAt(rows);
  }

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? { createdAt: String(last.created_at ?? ""), id: String(last.id ?? "") }
      : null;

  return { rows, hasMore, nextCursor, selectIncludedBoostedAt };
}

async function fetchActiveBoostedRows(authorUserId?: string): Promise<PostRowInput[]> {
  const exec = (select: string) => {
    let q = supabase.from("posts" as any).select(select).not("boosted_at", "is", null);
    if (authorUserId) q = q.eq("user_id", authorUserId);
    return q.order("boosted_at", { ascending: false }).limit(40);
  };

  let result = await exec(postsSelectWithBoost);
  if (result.error && isMissingBoostedAtError(result.error.message)) {
    result = await exec(postsSelectWithGeoAndBlur);
  }
  if (result.error) return [];

  return ((result.data ?? []) as Array<Record<string, unknown>>).map((row) => normalizePostRow(row));
}

export async function fetchPostsFeedPageLegacy(params: {
  cursor: LegacyFeedPostsCursor | null;
  userId?: string;
  followingSet: ReadonlySet<string>;
  authorUserId?: string;
  limit?: number;
}): Promise<LegacyFeedPostsPage> {
  const { cursor, userId, followingSet, authorUserId, limit = FEED_PAGE_SIZE } = params;

  const boostedRows = cursor ? [] : await fetchActiveBoostedRows(authorUserId);
  const { rows: chronRows, hasMore, nextCursor, selectIncludedBoostedAt } = await runPostsSelect({
    select: postsSelectWithBoost,
    cursor,
    limit,
    authorUserId,
  });

  const byId = new Map<string, PostRowInput>();
  for (const row of boostedRows) byId.set(row.id, row);
  for (const row of chronRows) byId.set(row.id, row);
  const mergedRows = [...byId.values()];
  if (!mergedRows.length) return { posts: [], hasMore: false, nextCursor: null };

  let postRows = mergedRows;
  if (!selectIncludedBoostedAt) {
    postRows = await enrichPostsBoostedAt(postRows);
  }

  const hydrated = await hydrateFeedPosts(postRows, { userId, followingSet });

  return {
    posts: hydrated,
    hasMore,
    nextCursor,
  };
}
