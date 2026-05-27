import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
  type ViewStyle,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useCreatePostComment,
  useDeletePostComment,
  usePostComments,
  useReactToPostComment,
  useReplyToPostComment,
  useUpdatePostComment,
  type PostComment,
} from "@/entities/post";
import { useProfile } from "@/entities/user";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { isAuthRequiredError } from "@/shared/lib/auth/authRequired";
import { profileMentionTag } from "@/shared/lib/profileMentionTag";
import { discussionPaletteDark, type DiscussionUiPalette } from "@/shared/theme/discussionPalette";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import {
  PostDiscussionCommentThread,
  type ReplyComposerTarget,
} from "./PostDiscussionCommentThread";

import { QUICK_EMOJI } from "../model/quickEmoji";

type EditingCommentTarget = {
  commentId: string;
  originalContent: string;
};

export type PostDiscussionPanelInnerProps = {
  postId: string;
  onRequireAuth: () => void;
  discussionPalette?: DiscussionUiPalette;
  footerBackgroundColor?: string;
  footerBorderColor?: string;
  listContentStyle?: ViewStyle;
  showEmojiRow?: boolean;
  onListContentSizeChange?: (width: number, height: number) => void;
  onClose?: () => void;
};

export function PostDiscussionPanelInner({
  postId,
  onRequireAuth,
  discussionPalette,
  footerBackgroundColor: footerBackgroundOverride,
  footerBorderColor: footerBorderOverride,
  listContentStyle: listContentStyleProp,
  showEmojiRow = true,
  onListContentSizeChange,
  onClose,
}: PostDiscussionPanelInnerProps) {
  const palette = discussionPalette ?? discussionPaletteDark;
  const footerBackgroundColor = footerBackgroundOverride ?? palette.footerBg;
  const footerBorderColor = footerBorderOverride ?? palette.footerBorder;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const composerInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const footerPaddingBottom =
    Platform.OS === "android" ? (keyboardVisible ? 4 : 8) : Math.max(16, insets.bottom + 10);

  const { data: comments = [] } = usePostComments(postId);
  const { data: myProfile } = useProfile();
  const createCommentMutation = useCreatePostComment();
  const replyThreadMutation = useReplyToPostComment();
  const reactMutation = useReactToPostComment();
  const updateCommentMutation = useUpdatePostComment();
  const deleteCommentMutation = useDeletePostComment();

  const [mainDraft, setMainDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyComposerTarget | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [editingComment, setEditingComment] = useState<EditingCommentTarget | null>(null);

  useEffect(() => {
    if (replyTarget) {
      setInlineReplyText(`${replyTarget.mentionTag} `);
    } else {
      setInlineReplyText("");
    }
  }, [replyTarget]);

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  const totalCommentCount = useMemo(
    () => sorted.reduce((acc, c) => acc + 1 + c.replies.length, 0),
    [sorted],
  );

  const submitMainComment = useCallback(async () => {
    const text = mainDraft.trim();
    if (!text || createCommentMutation.isPending) return;
    setMainDraft("");
    try {
      await createCommentMutation.mutateAsync({ postId, content: text });
    } catch (error) {
      setMainDraft(text);
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [createCommentMutation, mainDraft, onRequireAuth, postId]);

  const submitInlineReply = useCallback(async () => {
    const text = inlineReplyText.trim();
    const target = replyTarget;
    if (!text || !target || replyThreadMutation.isPending) return;
    const parentCommentId = target.rootCommentId;
    setReplyTarget(null);
    setInlineReplyText("");
    try {
      await replyThreadMutation.mutateAsync({
        postId,
        parentCommentId,
        content: text,
      });
    } catch (error) {
      setReplyTarget(target);
      setInlineReplyText(text);
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [inlineReplyText, onRequireAuth, postId, replyTarget, replyThreadMutation]);

  const toggleLikeComment = useCallback(
    async (comment: PostComment) => {
      try {
        await reactMutation.mutateAsync({ postId, commentId: comment.id, type: "like" });
      } catch (error) {
        if (isAuthRequiredError(error)) onRequireAuth();
      }
    },
    [onRequireAuth, postId, reactMutation],
  );

  const toggleLikeReply = useCallback(
    async (reply: PostComment["replies"][number]) => {
      try {
        await reactMutation.mutateAsync({ postId, commentId: reply.id, type: "like" });
      } catch (error) {
        if (isAuthRequiredError(error)) onRequireAuth();
      }
    },
    [onRequireAuth, postId, reactMutation],
  );

  const cancelEditingComment = useCallback(() => {
    setEditingComment(null);
    setMainDraft("");
  }, []);

  const startEditingComment = useCallback(
    (commentId: string, content: string) => {
      setReplyTarget(null);
      setInlineReplyText("");
      setEditingComment({ commentId, originalContent: content });
      setMainDraft(content.trim());
      requestAnimationFrame(() => composerInputRef.current?.focus());
    },
    [],
  );

  const refocusComposerInput = useCallback(() => {
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }, []);

  const appendEmojiToDraft = useCallback(
    (emoji: string) => {
      setMainDraft((prev) => `${prev}${emoji}`);
      refocusComposerInput();
    },
    [refocusComposerInput],
  );

  const saveEditedComment = useCallback(() => {
    if (!editingComment) return;
    const trimmed = mainDraft.trim();
    if (!trimmed) {
      Alert.alert("Comment required", "Comment text cannot be empty.");
      return;
    }
    if (trimmed === editingComment.originalContent.trim()) {
      cancelEditingComment();
      return;
    }
    void updateCommentMutation
      .mutateAsync({
        postId,
        commentId: editingComment.commentId,
        content: trimmed,
      })
      .then(() => {
        cancelEditingComment();
      })
      .catch((error) => {
        if (isAuthRequiredError(error)) {
          onRequireAuth();
          return;
        }
        Alert.alert("Edit failed", error instanceof Error ? error.message : "Please try again.");
      });
  }, [cancelEditingComment, editingComment, mainDraft, onRequireAuth, postId, updateCommentMutation]);

  const confirmDeleteComment = useCallback(
    (commentId: string) => {
      Alert.alert("Delete comment?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (editingComment?.commentId === commentId) {
              cancelEditingComment();
            }
            if (replyTarget) {
              setReplyTarget(null);
            }
            void deleteCommentMutation
              .mutateAsync({ postId, commentId })
              .catch((error) => {
                if (isAuthRequiredError(error)) {
                  onRequireAuth();
                  return;
                }
                Alert.alert("Delete failed", error instanceof Error ? error.message : "Please try again.");
              });
          },
        },
      ]);
    },
    [
      cancelEditingComment,
      deleteCommentMutation,
      editingComment?.commentId,
      onRequireAuth,
      postId,
      replyTarget,
    ],
  );

  const myAvatarRaw = myProfile?.avatar_url?.trim() || null;
  const myAvatarUri = getAvatarDisplayUrl(myAvatarRaw, { layoutPx: 32 });
  const myLabel =
    `${myProfile?.first_name?.trim() ?? ""} ${myProfile?.last_name?.trim() ?? ""}`.trim() || "Me";

  const renderItem = useCallback(
    ({ item }: { item: PostComment }) => (
      <PostDiscussionCommentThread
        palette={palette}
        comment={item}
        currentUserId={user?.id}
        replyTarget={replyTarget}
        inlineValue={inlineReplyText}
        inlineSubmitting={replyThreadMutation.isPending}
        onChangeInline={setInlineReplyText}
        onSubmitInline={() => void submitInlineReply()}
        onCloseInline={() => setReplyTarget(null)}
        onOpenReplyToComment={() => {
          if (editingComment) cancelEditingComment();
          setReplyTarget({
            anchorKey: `c-${item.id}`,
            rootCommentId: item.id,
            mentionTag: profileMentionTag(item.profile),
          });
        }}
        onOpenReplyToReply={(reply) => {
          if (editingComment) cancelEditingComment();
          setReplyTarget({
            anchorKey: `r-${reply.id}`,
            rootCommentId: item.id,
            mentionTag: profileMentionTag(reply.profile),
          });
        }}
        onToggleLikeComment={() => void toggleLikeComment(item)}
        onToggleLikeReply={(reply) => void toggleLikeReply(reply)}
        onEditComment={startEditingComment}
        onDeleteComment={confirmDeleteComment}
      />
    ),
    [
      cancelEditingComment,
      confirmDeleteComment,
      editingComment,
      inlineReplyText,
      palette,
      replyTarget,
      replyThreadMutation.isPending,
      startEditingComment,
      submitInlineReply,
      toggleLikeComment,
      toggleLikeReply,
      user?.id,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.countHeader}>
        <Text style={[styles.countLabel, { color: palette.text }]}>
          {totalCommentCount === 1 ? "1 comment" : `${totalCommentCount} comments`}
        </Text>
        <Text style={[styles.subLabel, { color: palette.textMuted }]}>Top comments</Text>
      </View>
    ),
    [palette.text, palette.textMuted, totalCommentCount],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={[styles.empty, { color: palette.textMuted }]}>No comments yet. Be the first to reply.</Text>
      </View>
    ),
    [palette.textMuted],
  );

  const listContentContainerStyle = useMemo(
    () => [styles.listContent, listContentStyleProp, sorted.length === 0 && styles.listContentEmpty],
    [listContentStyleProp, sorted.length],
  );

  return (
    <View style={styles.flex}>
      {onClose ? (
        <View style={styles.panelHeader}>
          <Text style={[styles.panelHeaderTitle, { color: palette.text }]}>Comments</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.panelCloseBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={palette.text} />
          </Pressable>
        </View>
      ) : null}
      <FlashList
        data={sorted}
        keyExtractor={(item) => item.id}
        estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.storyComment}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        extraData={[
          replyTarget,
          inlineReplyText,
          editingComment,
          replyThreadMutation.isPending,
          reactMutation.isPending,
          updateCommentMutation.isPending,
          sorted,
          palette,
          user?.id,
        ]}
        contentContainerStyle={listContentContainerStyle}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={listEmptyComponent}
        style={styles.list}
        onContentSizeChange={(w, h) => onListContentSizeChange?.(w, h)}
        removeClippedSubviews={Platform.OS !== "android"}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={8}
        updateCellsBatchingPeriod={40}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: footerBackgroundColor,
            borderTopColor: footerBorderColor,
            paddingBottom: footerPaddingBottom,
          },
        ]}
      >
        {editingComment ? (
          <View style={styles.editingBar}>
            <Text style={[styles.editingBarText, { color: palette.textMuted }]}>Editing comment</Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              onPress={cancelEditingComment}
            >
              <Ionicons name="close" size={18} color={palette.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {showEmojiRow ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={styles.emojiRow}
          >
            {QUICK_EMOJI.map((em) => (
              <Pressable key={em} hitSlop={4} style={styles.emojiChip} onPress={() => appendEmojiToDraft(em)}>
                <Text style={styles.emojiText}>{em}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.footerInputRow}>
          {myAvatarUri ? (
            <SmartImage
              uri={myAvatarUri}
              fallbackUri={myAvatarRaw && myAvatarRaw !== myAvatarUri ? myAvatarRaw : undefined}
              recyclingKey={myAvatarUri}
              style={styles.footerAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.footerAvatarFallback, { backgroundColor: palette.avatarFallback }]}>
              <Text style={[styles.footerAvatarLetter, { color: palette.text }]}>
                {myLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.footerInputWrap}>
            <RichTextarea
              ref={composerInputRef}
              value={mainDraft}
              onChangeText={setMainDraft}
              placeholder={editingComment ? "Edit comment..." : "Join the conversation..."}
              placeholderTextColor={palette.textMuted}
              textAlignVertical="center"
              editable={
                editingComment ? !updateCommentMutation.isPending : !createCommentMutation.isPending
              }
              style={[
                styles.footerInput,
                editingComment ? styles.footerInputEditing : null,
                { backgroundColor: palette.inputBg, color: palette.text },
              ]}
            />
            {editingComment ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save edited comment"
                style={[
                  styles.footerSaveBtn,
                  { backgroundColor: palette.sendAccent },
                  (!mainDraft.trim() || updateCommentMutation.isPending) && styles.footerSaveBtnDisabled,
                ]}
                disabled={!mainDraft.trim() || updateCommentMutation.isPending}
                onPress={saveEditedComment}
              >
                {updateCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.footerSendCircle,
                  { backgroundColor: palette.sendAccent },
                  (!mainDraft.trim() || createCommentMutation.isPending) && styles.footerSendCircleDisabled,
                ]}
                disabled={!mainDraft.trim() || createCommentMutation.isPending}
                onPress={() => void submitMainComment()}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
              >
                {createCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minHeight: 0,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingBottom: 8,
    minHeight: 40,
    zIndex: 2,
  },
  panelHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  panelCloseBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 8,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  countHeader: {
    paddingBottom: 12,
    gap: 4,
  },
  countLabel: {
    fontSize: 17,
    fontWeight: "800",
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  emojiRow: {
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  emojiChip: {
    paddingHorizontal: 2,
  },
  emojiText: {
    fontSize: 24,
  },
  editingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  editingBarText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    marginRight: 8,
  },
  footerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  footerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  footerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerAvatarLetter: {
    fontSize: 14,
    fontWeight: "700",
  },
  footerInputWrap: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  footerInput: {
    borderRadius: 22,
    borderWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    paddingLeft: 14,
    paddingRight: 52,
    paddingVertical: 10,
    fontSize: 14,
  },
  footerInputEditing: {
    paddingRight: 52,
  },
  footerSaveBtn: {
    position: "absolute",
    right: 6,
    bottom: 7,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  footerSaveBtnDisabled: {
    opacity: 0.45,
  },
  footerSendCircle: {
    position: "absolute",
    right: 6,
    bottom: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerSendCircleDisabled: {
    opacity: 0.45,
  },
});
