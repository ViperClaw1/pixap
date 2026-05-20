import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { CommentsSkeletonList } from "./CommentsSkeletonList";
import type { PostComment, PostReply } from "@/entities/post";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";

type Props = {
  visible: boolean;
  onClose: () => void;
  comments: PostComment[];
  isLoading?: boolean;
  hasSelectedPost: boolean;
  expandedCommentIds: Record<string, true>;
  replyTargetCommentId: string | null;
  commentInput: string;
  canSendComment: boolean;
  submittingComment: boolean;
  currentUserId: string | null | undefined;
  currentUserAvatarUrl: string | null;
  resolveAvatarUri: (value?: string | null) => string | null;
  savingCommentId: string | null;
  deletingCommentId: string | null;
  onToggleReplies: (commentId: string) => void;
  onReplyPress: (commentId: string) => void;
  onCancelReply: () => void;
  onChangeCommentInput: (value: string) => void;
  onSubmitComment: () => void;
  onSaveCommentEdit: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
};

function profileName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

type CommentBodyProps = {
  content: string;
  isEditing: boolean;
  editDraft: string;
  onChangeEditDraft: (value: string) => void;
  textStyle: object;
  inputStyle: object;
  colors: { text: string; textMuted: string; border: string; background: string };
};

function CommentBody({ content, isEditing, editDraft, onChangeEditDraft, textStyle, inputStyle, colors }: CommentBodyProps) {
  if (isEditing) {
    return (
      <TextInput
        value={editDraft}
        onChangeText={onChangeEditDraft}
        multiline
        autoFocus
        placeholder="Edit comment..."
        placeholderTextColor={colors.textMuted}
        style={[textStyle, inputStyle, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
    );
  }
  return <Text style={[textStyle, { color: colors.text }]}>{content}</Text>;
};

export function CommentsBottomSheet({
  visible,
  onClose,
  comments,
  isLoading = false,
  hasSelectedPost,
  expandedCommentIds,
  replyTargetCommentId,
  commentInput,
  canSendComment,
  submittingComment,
  currentUserId,
  currentUserAvatarUrl,
  resolveAvatarUri,
  savingCommentId,
  deletingCommentId,
  onToggleReplies,
  onReplyPress,
  onCancelReply,
  onChangeCommentInput,
  onSubmitComment,
  onSaveCommentEdit,
  onDeleteComment,
}: Props) {
  const { colors } = useAppTheme();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    if (!visible) {
      setEditingCommentId(null);
      setEditDraft("");
    }
  }, [visible]);

  const startEdit = useCallback((commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditDraft(content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditDraft("");
  }, []);

  const confirmSaveEdit = useCallback(() => {
    if (!editingCommentId || !editDraft.trim()) return;
    onSaveCommentEdit(editingCommentId, editDraft);
  }, [editDraft, editingCommentId, onSaveCommentEdit]);

  const prevSavingCommentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSavingCommentIdRef.current && savingCommentId === null) {
      cancelEdit();
    }
    prevSavingCommentIdRef.current = savingCommentId;
  }, [cancelEdit, savingCommentId]);

  const confirmDelete = useCallback(
    (commentId: string) => {
      Alert.alert("Delete comment?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteComment(commentId),
        },
      ]);
    },
    [onDeleteComment],
  );

  const renderOwnerActions = (item: PostComment | PostReply, isEditing: boolean) => {
    if (!currentUserId || item.user_id !== currentUserId) return null;
    const isSaving = savingCommentId === item.id;
    const isDeleting = deletingCommentId === item.id;

    return (
      <View style={styles.ownerActions}>
        <Pressable
          style={styles.iconActionBtn}
          disabled={isSaving || isDeleting}
          onPress={() => {
            if (isEditing) {
              confirmSaveEdit();
              return;
            }
            startEdit(item.id, item.content);
          }}
          accessibilityLabel={isEditing ? "Save comment" : "Edit comment"}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name={isEditing ? "checkmark" : "pencil"} size={16} color={colors.primary} />
          )}
        </Pressable>
        <Pressable
          style={styles.iconActionBtn}
          disabled={isSaving || isDeleting || isEditing}
          onPress={() => confirmDelete(item.id)}
          accessibilityLabel="Delete comment"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          )}
        </Pressable>
      </View>
    );
  };

  const renderMetaActions = (comment: PostComment) => {
    const repliesExpanded = !!expandedCommentIds[comment.id];
    const isReplyingToThis = replyTargetCommentId === comment.id;

    return (
      <View style={styles.modalCommentMetaRow}>
        <Text style={[styles.modalCommentTime, { color: colors.textMuted }]}>{formatRelativeTime(comment.created_at)}</Text>
        <View style={styles.commentMetaActions}>
          {isReplyingToThis ? (
            <Pressable style={styles.replyToggleBtn} onPress={onCancelReply}>
              <Text style={[styles.replyToggleText, { color: colors.primary }]}>Cancel reply</Text>
            </Pressable>
          ) : null}
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
          {renderOwnerActions(comment, editingCommentId === comment.id)}
        </View>
      </View>
    );
  };

  const composerFooter = hasSelectedPost ? (
    <View style={[styles.replyComposerWrap, { borderTopColor: colors.border }]}>
      <CommentComposer
        avatarUrl={currentUserAvatarUrl}
        showStickers
        value={commentInput}
        onChangeText={onChangeCommentInput}
        placeholder={replyTargetCommentId ? "Write a reply..." : "Add a comment..."}
        canSend={canSendComment}
        sending={submittingComment}
        onSend={onSubmitComment}
        minHeight={88}
      />
    </View>
  ) : null;

  const showEmptyState = !isLoading && !comments.length && hasSelectedPost;

  return (
    <BottomSheetPickerModal
      visible={visible}
      onClose={onClose}
      title="Comments"
      footer={composerFooter}
      maxHeightFraction={0.55}
      minHeightFraction={0.55}
      fitContent
      bodyContentContainerStyle={showEmptyState ? styles.emptyBodyContent : undefined}
    >
      <View style={[styles.commentsModalContent, showEmptyState && styles.emptyCommentsContent]}>
        {isLoading ? (
          <CommentsSkeletonList />
        ) : comments.length ? (
          comments.map((comment) => {
            const repliesExpanded = !!expandedCommentIds[comment.id];
            const isEditingComment = editingCommentId === comment.id;

            return (
              <View key={comment.id} style={[styles.modalCommentCard, { borderBottomColor: colors.border }]}>
                <View style={styles.commentAuthorRow}>
                  <UserAvatarImage
                    uri={resolveAvatarUri(comment.profile?.avatar_url)}
                    style={styles.commentAvatar}
                    contentFit="cover"
                    iconSize={11}
                  />
                  <Text style={[styles.commentAuthorName, { color: colors.text }]}>
                    {profileName(comment.profile?.first_name, comment.profile?.last_name)}
                  </Text>
                </View>
                <CommentBody
                  content={comment.content}
                  isEditing={isEditingComment}
                  editDraft={editDraft}
                  onChangeEditDraft={setEditDraft}
                  textStyle={styles.modalCommentText}
                  inputStyle={styles.editInput}
                  colors={colors}
                />
                {renderMetaActions(comment)}
                {repliesExpanded
                  ? comment.replies.map((reply) => {
                      const isEditingReply = editingCommentId === reply.id;
                      return (
                        <View key={reply.id} style={styles.replyRow}>
                          <View style={styles.commentAuthorRow}>
                            <UserAvatarImage
                              uri={resolveAvatarUri(reply.profile?.avatar_url)}
                              style={styles.replyAvatar}
                              contentFit="cover"
                              iconSize={9}
                            />
                            <Text style={[styles.replyAuthorName, { color: colors.text }]}>
                              {profileName(reply.profile?.first_name, reply.profile?.last_name)}
                            </Text>
                          </View>
                          <CommentBody
                            content={reply.content}
                            isEditing={isEditingReply}
                            editDraft={editDraft}
                            onChangeEditDraft={setEditDraft}
                            textStyle={styles.replyText}
                            inputStyle={styles.editInputCompact}
                            colors={colors}
                          />
                          <View style={styles.replyMetaRow}>
                            <Text style={[styles.replyTime, { color: colors.textMuted }]}>
                              {formatRelativeTime(reply.created_at)}
                            </Text>
                            {renderOwnerActions(reply, isEditingReply)}
                          </View>
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })
        ) : showEmptyState ? (
          <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>No comments yet.</Text>
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
  emptyBodyContent: {
    justifyContent: "center",
  },
  emptyCommentsContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    textAlignVertical: "top",
  },
  editInputCompact: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 40,
    textAlignVertical: "top",
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
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    flex: 1,
  },
  modalCommentTime: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 0,
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
  ownerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  replyRow: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(127,127,127,0.35)",
    gap: 4,
  },
  replyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
  },
  replyComposerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
});
