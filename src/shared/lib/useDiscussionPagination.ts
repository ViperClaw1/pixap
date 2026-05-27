import { useCallback, useEffect, useState } from "react";
import {
  DISCUSSION_COMMENTS_INITIAL_VISIBLE,
  DISCUSSION_COMMENTS_PAGE_SIZE,
  DISCUSSION_REPLIES_INITIAL_VISIBLE,
  DISCUSSION_REPLIES_PAGE_SIZE,
} from "./discussionPagination";

type Options = {
  entityId: string;
  isActive?: boolean;
};

export function useDiscussionPagination({ entityId, isActive = true }: Options) {
  const [visibleCommentCount, setVisibleCommentCount] = useState(DISCUSSION_COMMENTS_INITIAL_VISIBLE);
  const [replyVisibleCounts, setReplyVisibleCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isActive) return;
    setVisibleCommentCount(DISCUSSION_COMMENTS_INITIAL_VISIBLE);
    setReplyVisibleCounts({});
  }, [entityId, isActive]);

  const getReplyVisibleCount = useCallback(
    (commentId: string) => replyVisibleCounts[commentId] ?? DISCUSSION_REPLIES_INITIAL_VISIBLE,
    [replyVisibleCounts],
  );

  const showMoreComments = useCallback((total: number) => {
    setVisibleCommentCount((count) => Math.min(total, count + DISCUSSION_COMMENTS_PAGE_SIZE));
  }, []);

  const showMoreReplies = useCallback((commentId: string, totalReplies: number) => {
    setReplyVisibleCounts((prev) => ({
      ...prev,
      [commentId]: Math.min(
        totalReplies,
        (prev[commentId] ?? DISCUSSION_REPLIES_INITIAL_VISIBLE) + DISCUSSION_REPLIES_PAGE_SIZE,
      ),
    }));
  }, []);

  return {
    visibleCommentCount,
    replyVisibleCounts,
    getReplyVisibleCount,
    showMoreComments,
    showMoreReplies,
  };
}
