import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import type { PostComment } from "@/entities/post";

type Props = {
  visible: boolean;
  onClose: () => void;
  comments: PostComment[];
  hasSelectedPost: boolean;
  expandedCommentIds: Record<string, true>;
  replyTargetCommentId: string | null;
  commentInput: string;
  canSendComment: boolean;
  submittingComment: boolean;
  currentUserAvatarUrl: string | null;
  resolveAvatarUri: (value?: string | null) => string | null;
  formatRelativeTime: (value: string) => string;
  onToggleReplies: (commentId: string) => void;
  onReplyPress: (commentId: string) => void;
  onCancelReply: () => void;
  onChangeCommentInput: (value: string) => void;
  onSubmitComment: () => void;
};

function profileName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

export function CommentsBottomSheet({
  visible,
  onClose,
  comments,
  hasSelectedPost,
  expandedCommentIds,
  replyTargetCommentId,
  commentInput,
  canSendComment,
  submittingComment,
  currentUserAvatarUrl,
  resolveAvatarUri,
  formatRelativeTime,
  onToggleReplies,
  onReplyPress,
  onCancelReply,
  onChangeCommentInput,
  onSubmitComment,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <BottomSheetPickerModal visible={visible} onClose={onClose} title="Comments">
      <View style={styles.commentsModalContent}>
        {comments.length ? (
          comments.map((comment) => {
            const repliesExpanded = !!expandedCommentIds[comment.id];
            return (
              <View key={comment.id} style={[styles.modalCommentCard, { borderBottomColor: colors.border }]}>
                <View style={styles.commentAuthorRow}>
                  {resolveAvatarUri(comment.profile?.avatar_url) ? (
                    <SmartImage uri={resolveAvatarUri(comment.profile?.avatar_url)} style={styles.commentAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.commentAvatar, { backgroundColor: colors.card }]} />
                  )}
                  <Text style={[styles.commentAuthorName, { color: colors.text }]}>
                    {profileName(comment.profile?.first_name, comment.profile?.last_name)}
                  </Text>
                </View>
                <Text style={[styles.modalCommentText, { color: colors.text }]}>{comment.content}</Text>
                <View style={styles.modalCommentMetaRow}>
                  <Text style={[styles.modalCommentTime, { color: colors.textMuted }]}>{formatRelativeTime(comment.created_at)}</Text>
                  <View style={styles.commentMetaActions}>
                    <Pressable style={styles.replyToggleBtn} onPress={() => onReplyPress(comment.id)}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.replyToggleText, { color: colors.textMuted }]}>Reply</Text>
                    </Pressable>
                    {comment.replies.length ? (
                      <Pressable style={styles.replyToggleBtn} onPress={() => onToggleReplies(comment.id)}>
                        <Ionicons name="return-up-forward-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.replyToggleText, { color: colors.textMuted }]}>
                          {repliesExpanded ? "Hide replies" : `Replies (${comment.replies.length})`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {repliesExpanded
                  ? comment.replies.map((reply) => (
                      <View key={reply.id} style={styles.replyRow}>
                        <View style={styles.commentAuthorRow}>
                          {resolveAvatarUri(reply.profile?.avatar_url) ? (
                            <SmartImage uri={resolveAvatarUri(reply.profile?.avatar_url)} style={styles.replyAvatar} contentFit="cover" />
                          ) : (
                            <View style={[styles.replyAvatar, { backgroundColor: colors.card }]} />
                          )}
                          <Text style={[styles.replyAuthorName, { color: colors.text }]}>
                            {profileName(reply.profile?.first_name, reply.profile?.last_name)}
                          </Text>
                        </View>
                        <Text style={[styles.replyText, { color: colors.text }]}>{reply.content}</Text>
                        <Text style={[styles.replyTime, { color: colors.textMuted }]}>{formatRelativeTime(reply.created_at)}</Text>
                      </View>
                    ))
                  : null}
              </View>
            );
          })
        ) : hasSelectedPost ? (
          <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>No comments yet.</Text>
        ) : null}

        {hasSelectedPost ? (
          <View style={[styles.replyComposerWrap, { borderTopColor: colors.border }]}>
            <CommentComposer
              avatarUrl={currentUserAvatarUrl}
              value={commentInput}
              onChangeText={onChangeCommentInput}
              placeholder={replyTargetCommentId ? "Write a reply..." : "Add a comment..."}
              canSend={canSendComment}
              sending={submittingComment}
              onSend={onSubmitComment}
            />
            {replyTargetCommentId ? (
              <Pressable onPress={onCancelReply}>
                <Text style={[styles.replyComposerCancel, { color: colors.primary }]}>Cancel reply</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </BottomSheetPickerModal>
  );
}

const styles = StyleSheet.create({
  commentsModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCommentCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 8,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalCommentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalCommentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commentMetaActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalCommentTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  replyToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyRow: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(127,127,127,0.35)",
    gap: 4,
  },
  replyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  replyAuthorName: {
    fontSize: 12,
    fontWeight: "700",
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  noCommentsText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  replyComposerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  replyComposerCancel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
});
