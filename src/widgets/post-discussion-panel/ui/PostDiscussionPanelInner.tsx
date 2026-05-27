import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextInput,
  type ViewStyle,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
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
import { profileDisplayName } from "@/shared/lib/profileDisplayName";
import { profileMentionTag } from "@/shared/lib/profileMentionTag";
import { discussionPaletteDark, type DiscussionUiPalette } from "@/shared/theme/discussionPalette";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import {
  PostDiscussionCommentThread,
  type ReplyComposerTarget,
} from "./PostDiscussionCommentThread";

import { QUICK_EMOJI } from "@/shared/lib/discussionQuickEmoji";
import { AppPopupModal, appAlert } from "@/shared/ui/app-popup";
import { DiscussionCommentSkeletonList } from "@/shared/ui/discussion-skeleton";
import {
  DISCUSSION_IOS_LIST_FOOTER_CLEARANCE,
  KeyboardStickyView,
  useDiscussionPanelFooterKeyboard,
} from "@/shared/lib/keyboard";
import Animated from "react-native-reanimated";
import { DiscussionShowMoreButton } from "@/shared/ui/discussion-show-more/DiscussionShowMoreButton";
import {
  getVisibleDiscussionComments,
  hasHiddenDiscussionComments,
} from "@/shared/lib/discussionPagination";
import { useDiscussionPagination } from "@/shared/lib/useDiscussionPagination";
import { useDiscussionListScroll } from "@/shared/lib/useDiscussionListScroll";

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
  /** When false, pagination/scroll reset waits until the sheet opens again. Defaults to true. */
  isActive?: boolean;
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
  isActive = true,
}: PostDiscussionPanelInnerProps) {
  const palette = discussionPalette ?? discussionPaletteDark;
  const footerBackgroundColor = footerBackgroundOverride ?? palette.footerBg;
  const footerBorderColor = footerBorderOverride ?? palette.footerBorder;
  const [footerHeight, setFooterHeight] = useState(120);
  const composerInputRef = useRef<TextInput>(null);
  const footerShellRef = useRef<View>(null);
  const {
    RootOuter,
    rootLiftStyle,
    footerPaddingBottom,
    useStickyFooter,
    composerStickyInset,
    iosStickyFooterPaddingStyle,
  } = useDiscussionPanelFooterKeyboard(isActive, { host: "navigation-modal" });
  const { user } = useAuth();
  const composerBlurResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressComposerBlurResetRef = useRef(false);

  useEffect(
    () => () => {
      if (composerBlurResetTimeoutRef.current) {
        clearTimeout(composerBlurResetTimeoutRef.current);
      }
    },
    [],
  );

  const { data: comments = [], isLoading: commentsLoading } = usePostComments(postId);
  const { data: myProfile } = useProfile();
  const createCommentMutation = useCreatePostComment();
  const replyThreadMutation = useReplyToPostComment();
  const reactMutation = useReactToPostComment();
  const updateCommentMutation = useUpdatePostComment();
  const deleteCommentMutation = useDeletePostComment();

  const [mainDraft, setMainDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyComposerTarget | null>(null);
  const replyTargetRef = useRef<ReplyComposerTarget | null>(null);
  replyTargetRef.current = replyTarget;
  const [editingComment, setEditingComment] = useState<EditingCommentTarget | null>(null);
  const editingCommentRef = useRef<EditingCommentTarget | null>(null);
  editingCommentRef.current = editingComment;
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  const {
    visibleCommentCount,
    replyVisibleCounts,
    getReplyVisibleCount,
    showMoreComments,
    showMoreReplies,
  } = useDiscussionPagination({ entityId: postId, isActive });

  const visibleComments = useMemo(
    () => getVisibleDiscussionComments(sorted, visibleCommentCount),
    [sorted, visibleCommentCount],
  );

  const showMoreCommentsButton = hasHiddenDiscussionComments(sorted.length, visibleCommentCount);

  const { listRef, scrollToIndex, scrollToBottom } = useDiscussionListScroll<PostComment>({
    entityId: postId,
    isActive,
    isLoading: commentsLoading,
    itemCount: visibleComments.length,
  });

  const totalCommentCount = useMemo(
    () => sorted.reduce((acc, c) => acc + 1 + c.replies.length, 0),
    [sorted],
  );

  const clearPendingReplyBlurReset = useCallback(() => {
    if (composerBlurResetTimeoutRef.current) {
      clearTimeout(composerBlurResetTimeoutRef.current);
      composerBlurResetTimeoutRef.current = null;
    }
  }, []);

  const resetReplyComposer = useCallback(() => {
    clearPendingReplyBlurReset();
    suppressComposerBlurResetRef.current = false;
    replyTargetRef.current = null;
    setReplyTarget(null);
    setMainDraft("");
    composerInputRef.current?.blur();
    Keyboard.dismiss();
  }, [clearPendingReplyBlurReset]);

  const cancelReply = useCallback(() => {
    resetReplyComposer();
  }, [resetReplyComposer]);

  const resetEditingComposer = useCallback(() => {
    clearPendingReplyBlurReset();
    suppressComposerBlurResetRef.current = false;
    editingCommentRef.current = null;
    setEditingComment(null);
    setMainDraft("");
    composerInputRef.current?.blur();
    Keyboard.dismiss();
  }, [clearPendingReplyBlurReset]);

  const cancelEditingComment = useCallback(() => {
    resetEditingComposer();
  }, [resetEditingComposer]);

  const startReply = useCallback(
    (target: ReplyComposerTarget) => {
      clearPendingReplyBlurReset();
      suppressComposerBlurResetRef.current = false;
      if (editingCommentRef.current) {
        editingCommentRef.current = null;
        setEditingComment(null);
      }
      setReplyTarget(target);
      setMainDraft(`${target.mentionTag} `);
      requestAnimationFrame(() => composerInputRef.current?.focus());
    },
    [clearPendingReplyBlurReset],
  );

  const handleComposerBlur = useCallback(() => {
    if (!replyTargetRef.current && !editingCommentRef.current) return;
    clearPendingReplyBlurReset();
    composerBlurResetTimeoutRef.current = setTimeout(() => {
      composerBlurResetTimeoutRef.current = null;
      if (suppressComposerBlurResetRef.current) {
        suppressComposerBlurResetRef.current = false;
        return;
      }
      if (replyTargetRef.current) {
        cancelReply();
        return;
      }
      if (editingCommentRef.current) {
        cancelEditingComment();
      }
    }, 100);
  }, [cancelEditingComment, cancelReply, clearPendingReplyBlurReset]);

  const submitMainComment = useCallback(async () => {
    const text = mainDraft.trim();
    if (!text || createCommentMutation.isPending) return;
    setMainDraft("");
    try {
      await createCommentMutation.mutateAsync({ postId, content: text });
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (error) {
      setMainDraft(text);
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [createCommentMutation, mainDraft, onRequireAuth, postId, scrollToBottom]);

  const submitThreadReply = useCallback(async () => {
    const text = mainDraft.trim();
    const target = replyTarget;
    if (!text || !target || replyThreadMutation.isPending) return;
    const parentCommentId = target.rootCommentId;
    resetReplyComposer();
    try {
      await replyThreadMutation.mutateAsync({
        postId,
        parentCommentId,
        content: text,
      });
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (error) {
      setReplyTarget(target);
      replyTargetRef.current = target;
      setMainDraft(text);
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [mainDraft, onRequireAuth, postId, replyTarget, replyThreadMutation, resetReplyComposer, scrollToBottom]);

  const handleShowMoreComments = useCallback(() => {
    showMoreComments(sorted.length);
    requestAnimationFrame(() => scrollToIndex(0, true));
  }, [showMoreComments, scrollToIndex, sorted.length]);

  const handleShowMoreReplies = useCallback(
    (commentId: string, totalReplies: number, commentIndex: number) => {
      showMoreReplies(commentId, totalReplies);
      requestAnimationFrame(() => scrollToIndex(commentIndex, true));
    },
    [showMoreReplies, scrollToIndex],
  );

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

  const startEditingComment = useCallback(
    (commentId: string, content: string) => {
      clearPendingReplyBlurReset();
      suppressComposerBlurResetRef.current = false;
      replyTargetRef.current = null;
      setReplyTarget(null);
      setEditingComment({ commentId, originalContent: content });
      setMainDraft(content.trim());
      requestAnimationFrame(() => composerInputRef.current?.focus());
    },
    [clearPendingReplyBlurReset],
  );

  const refocusComposerInput = useCallback(() => {
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }, []);

  const appendEmojiToDraft = useCallback(
    (emoji: string) => {
      suppressComposerBlurResetRef.current = true;
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

  const dismissDeletePopup = useCallback(() => {
    setDeleteTargetId(null);
  }, []);

  const requestDeleteComment = useCallback((commentId: string) => {
    setDeleteTargetId(commentId);
  }, []);

  const executeDeleteComment = useCallback(() => {
    if (!deleteTargetId) return;
    const commentId = deleteTargetId;

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
        appAlert("Delete failed", error instanceof Error ? error.message : "Please try again.", undefined, "alert");
      });
  }, [
    cancelEditingComment,
    deleteCommentMutation,
    deleteTargetId,
    editingComment?.commentId,
    onRequireAuth,
    postId,
    replyTarget,
  ]);

  const myAvatarRaw = myProfile?.avatar_url?.trim() || null;
  const myAvatarUri = getAvatarDisplayUrl(myAvatarRaw, { layoutPx: 32 });
  const myLabel =
    `${myProfile?.first_name?.trim() ?? ""} ${myProfile?.last_name?.trim() ?? ""}`.trim() || "Me";

  const renderItem = useCallback(
    ({ item, index }: { item: PostComment; index: number }) => (
      <PostDiscussionCommentThread
        palette={palette}
        comment={item}
        currentUserId={user?.id}
        visibleReplyCount={getReplyVisibleCount(item.id)}
        onShowMoreReplies={() => handleShowMoreReplies(item.id, item.replies.length, index)}
        onOpenReplyToComment={() => {
          startReply({
            rootCommentId: item.id,
            mentionTag: profileMentionTag(item.profile),
            replyingToLabel: profileDisplayName(item.profile),
          });
        }}
        onOpenReplyToReply={(reply) => {
          startReply({
            rootCommentId: item.id,
            mentionTag: profileMentionTag(reply.profile),
            replyingToLabel: profileDisplayName(reply.profile),
          });
        }}
        onToggleLikeComment={() => void toggleLikeComment(item)}
        onToggleLikeReply={(reply) => void toggleLikeReply(reply)}
        onEditComment={startEditingComment}
        onDeleteComment={requestDeleteComment}
      />
    ),
    [
      getReplyVisibleCount,
      handleShowMoreReplies,
      palette,
      requestDeleteComment,
      startEditingComment,
      startReply,
      toggleLikeComment,
      toggleLikeReply,
      user?.id,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View>
        {showMoreCommentsButton ? (
          <DiscussionShowMoreButton
            label="Show more comments"
            onPress={handleShowMoreComments}
            palette={palette}
            style={styles.showMoreComments}
          />
        ) : null}
        <View style={styles.countHeader}>
          <Text style={[styles.countLabel, { color: palette.text }]}>
            {totalCommentCount === 1 ? "1 comment" : `${totalCommentCount} comments`}
          </Text>
          <Text style={[styles.subLabel, { color: palette.textMuted }]}>Top comments</Text>
        </View>
      </View>
    ),
    [
      handleShowMoreComments,
      palette,
      showMoreCommentsButton,
      totalCommentCount,
    ],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={[styles.empty, { color: palette.textMuted }]}>No comments yet. Be the first to reply.</Text>
      </View>
    ),
    [palette.textMuted],
  );

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const listContentContainerStyle = useMemo(
    () => [
      styles.listContent,
      listContentStyleProp,
      useStickyFooter && Platform.OS === "ios"
        ? { paddingBottom: footerHeight + DISCUSSION_IOS_LIST_FOOTER_CLEARANCE }
        : null,
      !commentsLoading && sorted.length === 0 && styles.listContentEmpty,
    ],
    [commentsLoading, footerHeight, listContentStyleProp, sorted.length, useStickyFooter],
  );

  const composerFooter = useMemo(() => {
    const FooterShell = useStickyFooter ? Animated.View : View;

    return (
      <FooterShell
        ref={useStickyFooter ? undefined : footerShellRef}
        style={[
          styles.footer,
          {
            backgroundColor: footerBackgroundColor,
            borderTopColor: footerBorderColor,
          },
          useStickyFooter ? iosStickyFooterPaddingStyle : { paddingBottom: footerPaddingBottom },
        ]}
      >
        {editingComment ? (
          <View style={styles.contextBar}>
            <Text style={[styles.contextBarText, { color: palette.textMuted }]}>Editing comment</Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
              onPress={cancelEditingComment}
            >
              <Ionicons name="close" size={18} color={palette.textMuted} />
            </Pressable>
          </View>
        ) : replyTarget ? (
          <View style={styles.contextBar}>
            <Text style={[styles.contextBarText, { color: palette.textMuted }]}>
              Replying to {replyTarget.replyingToLabel}
            </Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              onPress={cancelReply}
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
              onBlur={handleComposerBlur}
              placeholder={
                editingComment ? "Edit comment..." : replyTarget ? "Add a reply..." : "Join the conversation..."
              }
              placeholderTextColor={palette.textMuted}
              textAlignVertical="center"
              editable={
                editingComment
                  ? !updateCommentMutation.isPending
                  : replyTarget
                    ? !replyThreadMutation.isPending
                    : !createCommentMutation.isPending
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
                onPressIn={() => {
                  suppressComposerBlurResetRef.current = true;
                }}
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
                  (!mainDraft.trim() ||
                    (replyTarget ? replyThreadMutation.isPending : createCommentMutation.isPending)) &&
                    styles.footerSendCircleDisabled,
                ]}
                disabled={
                  !mainDraft.trim() ||
                  (replyTarget ? replyThreadMutation.isPending : createCommentMutation.isPending)
                }
                onPressIn={() => {
                  suppressComposerBlurResetRef.current = true;
                }}
                onPress={() => void (replyTarget ? submitThreadReply() : submitMainComment())}
                accessibilityRole="button"
                accessibilityLabel={replyTarget ? "Send reply" : "Send comment"}
              >
                {(replyTarget ? replyThreadMutation.isPending : createCommentMutation.isPending) ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </FooterShell>
    );
  }, [
      appendEmojiToDraft,
      cancelEditingComment,
      cancelReply,
      createCommentMutation.isPending,
      editingComment,
      footerBackgroundColor,
      footerBorderColor,
      footerPaddingBottom,
      handleComposerBlur,
      iosStickyFooterPaddingStyle,
      mainDraft,
      myAvatarRaw,
      myAvatarUri,
      myLabel,
      palette.avatarFallback,
      palette.inputBg,
      palette.sendAccent,
      palette.text,
      palette.textMuted,
      replyTarget,
      replyThreadMutation.isPending,
      saveEditedComment,
      showEmojiRow,
      submitMainComment,
      submitThreadReply,
      updateCommentMutation.isPending,
      useStickyFooter,
    ],
  );

  const handleSkeletonLayout = useCallback(
    (width: number, height: number) => {
      onListContentSizeChange?.(width, height);
    },
    [onListContentSizeChange],
  );

  return (
    <RootOuter style={[styles.flex, rootLiftStyle]}>
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
      {commentsLoading ? (
        <View style={styles.list}>
          <DiscussionCommentSkeletonList onLayout={handleSkeletonLayout} />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={visibleComments}
          keyExtractor={(item) => item.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.storyComment}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          extraData={[
            replyTarget,
            editingComment,
            replyThreadMutation.isPending,
            reactMutation.isPending,
            updateCommentMutation.isPending,
            visibleComments,
            visibleCommentCount,
            replyVisibleCounts,
            palette,
            user?.id,
          ]}
          contentContainerStyle={listContentContainerStyle}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          ListEmptyComponent={listEmptyComponent}
          style={styles.list}
          onContentSizeChange={(w, h) => onListContentSizeChange?.(w, h)}
          removeClippedSubviews={Platform.OS !== "android"}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          updateCellsBatchingPeriod={40}
        />
      )}

      {useStickyFooter ? (
        <KeyboardStickyView
          gap={0}
          bottomInset={0}
          enabled={isActive}
          inset={composerStickyInset}
          onLayout={handleFooterLayout}
        >
          {composerFooter}
        </KeyboardStickyView>
      ) : (
        composerFooter
      )}

      <Modal
        visible={deleteTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissDeletePopup}
      >
        <AppPopupModal
          embedded
          visible={deleteTargetId !== null}
          variant="alert"
          title="Delete comment?"
          message="This cannot be undone."
          onClose={dismissDeletePopup}
          buttons={[
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: executeDeleteComment },
          ]}
        />
      </Modal>
    </RootOuter>
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
  showMoreComments: {
    marginBottom: 4,
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
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  contextBarText: {
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
