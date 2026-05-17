import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { useMyFollowing } from "@/entities/user";
import {
  hydrateFeedPosts,
  isMissingGeoColumnsError,
  isMissingMediaBlurhashesError,
  normalizePostRow,
  type PostRowInput,
} from "../lib/hydrateFeedPosts";
import type { FeedPostItem } from "./usePostsFeed";

async function fetchPostRowById(postId: string): Promise<PostRowInput | null> {
  const postsSelectLegacy = "id, user_id, place_id, content, media_url, created_at";
  const postsSelectWithGeo =
    "id, user_id, place_id, content, media_url, created_at, geo_place_name, geo_formatted_address, geo_latitude, geo_longitude";
  const postsSelectWithGeoAndBlur = `${postsSelectWithGeo}, media_blurhashes`;

  let result = await supabase.from("posts" as any).select(postsSelectWithGeoAndBlur).eq("id", postId).maybeSingle();
  if (result.error && isMissingGeoColumnsError(result.error.message)) {
    result = await supabase.from("posts" as any).select(postsSelectLegacy).eq("id", postId).maybeSingle();
  } else if (result.error && isMissingMediaBlurhashesError(result.error.message)) {
    result = await supabase.from("posts" as any).select(postsSelectWithGeo).eq("id", postId).maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data) return null;
  return normalizePostRow(result.data as Partial<PostRowInput>);
}

export function usePostById(postId: string | undefined) {
  const { user } = useAuth();
  const { followingSet } = useMyFollowing();

  return useQuery({
    queryKey: queryKeys.posts.byId(postId ?? "", user?.id ?? null),
    enabled: Boolean(postId?.trim()),
    queryFn: async (): Promise<FeedPostItem | null> => {
      const row = await fetchPostRowById(postId!.trim());
      if (!row) return null;
      const [hydrated] = await hydrateFeedPosts([row], { userId: user?.id, followingSet });
      return hydrated ?? null;
    },
    staleTime: 60 * 1000,
  });
}
