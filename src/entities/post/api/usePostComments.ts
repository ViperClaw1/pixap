import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import type { PostProfile } from "@/shared/model/types/posts";

export interface PostReply {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string;
  content: string;
  created_at: string;
  profile: PostProfile | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: null;
  content: string;
  created_at: string;
  profile: PostProfile | null;
  replies: PostReply[];
}

const EMPTY_POST_COMMENTS: PostComment[] = [];

function selectStablePostComments(data: PostComment[]) {
  return data.length === 0 ? EMPTY_POST_COMMENTS : data;
}

export const usePostComments = (postId: string) => {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`post_comments_${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(postId) });
      })
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);

  return useQuery({
    queryKey: queryKeys.posts.comments(postId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments" as any)
        .select("id, post_id, user_id, parent_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const allComments = (data ?? []) as Array<{
        id: string;
        post_id: string;
        user_id: string;
        parent_id: string | null;
        content: string;
        created_at: string;
      }>;

      const profileIds = Array.from(new Set(allComments.map((item) => item.user_id)));
      const { data: profilesData, error: profilesError } = await supabase
        .from("public_profiles" as any)
        .select("id, first_name, last_name, avatar_url, username")
        .in("id", profileIds);
      if (profilesError) throw profilesError;

      const profiles = new Map<string, PostProfile>(
        ((profilesData ?? []) as PostProfile[]).map((profile) => [profile.id, profile]),
      );

      const comments = allComments.filter((item) => !item.parent_id);
      const replies = allComments.filter((item): item is Omit<PostReply, "profile"> => !!item.parent_id);
      const repliesByCommentId = new Map<string, PostReply[]>();
      for (const reply of replies) {
        if (!repliesByCommentId.has(reply.parent_id)) repliesByCommentId.set(reply.parent_id, []);
        repliesByCommentId.get(reply.parent_id)!.push({
          ...reply,
          profile: profiles.get(reply.user_id) ?? null,
        });
      }

      return comments.map((comment) => ({
        ...comment,
        parent_id: null,
        profile: profiles.get(comment.user_id) ?? null,
        replies: repliesByCommentId.get(comment.id) ?? [],
      })) as PostComment[];
    },
    enabled: !!postId,
    refetchInterval: realtimeConnected ? false : 15000,
    select: selectStablePostComments,
  });
};
