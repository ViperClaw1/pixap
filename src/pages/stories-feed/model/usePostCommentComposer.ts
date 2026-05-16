import { useCallback, useState } from "react";

export function usePostCommentComposer() {
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<string, true>>({});
  const [expandedPostContentIds, setExpandedPostContentIds] = useState<Record<string, true>>({});
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");

  const openComments = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setReplyTargetCommentId(null);
    setExpandedCommentIds({});
    setIsCommentsModalVisible(true);
  }, []);

  const closeComments = useCallback(() => {
    setIsCommentsModalVisible(false);
    setReplyTargetCommentId(null);
    setCommentInput("");
  }, []);

  const startReply = useCallback((commentId: string, mentionTag: string) => {
    setReplyTargetCommentId(commentId);
    setCommentInput(`${mentionTag} `);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTargetCommentId(null);
    setCommentInput("");
  }, []);

  const toggleReplies = useCallback((commentId: string) => {
    setExpandedCommentIds((prev) => {
      if (prev[commentId]) {
        const { [commentId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [commentId]: true };
    });
  }, []);

  const toggleExpandContent = useCallback((postId: string) => {
    setExpandedPostContentIds((prev) => {
      if (prev[postId]) {
        const { [postId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [postId]: true };
    });
  }, []);

  const canSendComment = (isPending: boolean) => commentInput.trim().length > 0 && !isPending;

  return {
    isCommentsModalVisible,
    selectedPostId,
    expandedCommentIds,
    expandedPostContentIds,
    replyTargetCommentId,
    commentInput,
    openComments,
    closeComments,
    toggleReplies,
    toggleExpandContent,
    startReply,
    cancelReply,
    setCommentInput,
    canSendComment,
  };
}
