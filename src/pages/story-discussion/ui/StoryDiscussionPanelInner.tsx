import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useReactToStory,
  useReplyToComment,
  useReplyToStory,
  useStoryComments,
  type StoryComment,
  type StoryReply,
} from "@/entities/story";
import { useProfile } from "@/entities/user";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { isAuthRequiredError } from "@/lib/authRequired";
import { profileMentionTag } from "../lib/storyDiscussionMention";
import {
  StoryDiscussionCommentThread,
  type ReplyComposerTarget,
} from "./StoryDiscussionCommentThread";
import {
  discussionPaletteDark,
  type DiscussionUiPalette,
} from "../lib/discussionUiPalette";

const QUICK_EMOJI = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

export type StoryDiscussionPanelInnerProps = {
  storyId: string;
  onRequireAuth: () => void;
  /** Text / list / footer colors; glass sheet passes dark palette and overrides footer alpha */
  discussionPalette?: DiscussionUiPalette;
  /** Page = solid #121212; glass sheet = translucent */
  footerBackgroundColor?: string;
  footerBorderColor?: string;
  listContentStyle?: ViewStyle;
  showEmojiRow?: boolean;
  /** Allows parent sheets to size themselves from list scroll height */
  onListContentSizeChange?: (width: number, height: number) => void;
};

export function StoryDiscussionPanelInner({
  storyId,
  onRequireAuth,
  discussionPalette,
  footerBackgroundColor: footerBackgroundOverride,
  footerBorderColor: footerBorderOverride,
  listContentStyle,
  showEmojiRow = true,
  onListContentSizeChange,
}: StoryDiscussionPanelInnerProps) {
  const palette = discussionPalette ?? discussionPaletteDark;
  const footerBackgroundColor = footerBackgroundOverride ?? palette.footerBg;
  const footerBorderColor = footerBorderOverride ?? palette.footerBorder;
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(16, insets.bottom + 10);

  const { data: comments = [] } = useStoryComments(storyId);
  const { data: myProfile } = useProfile();
  const replyMutation = useReplyToStory();
  const replyThreadMutation = useReplyToComment();
  const reactMutation = useReactToStory();

  const [mainDraft, setMainDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyComposerTarget | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState("");

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
    if (!text || replyMutation.isPending) return;
    try {
      await replyMutation.mutateAsync({ storyId, content: text });
      setMainDraft("");
    } catch (error) {
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [mainDraft, onRequireAuth, replyMutation, storyId]);

  const submitInlineReply = useCallback(async () => {
    const text = inlineReplyText.trim();
    if (!text || !replyTarget || replyThreadMutation.isPending) return;
    try {
      await replyThreadMutation.mutateAsync({
        storyId,
        commentId: replyTarget.rootCommentId,
        content: text,
      });
      setReplyTarget(null);
    } catch (error) {
      if (isAuthRequiredError(error)) onRequireAuth();
    }
  }, [inlineReplyText, onRequireAuth, replyTarget, replyThreadMutation, storyId]);

  const toggleLikeComment = useCallback(
    async (comment: StoryComment) => {
      try {
        await reactMutation.mutateAsync({ storyId, commentId: comment.id, type: "like" });
      } catch (error) {
        if (isAuthRequiredError(error)) onRequireAuth();
      }
    },
    [onRequireAuth, reactMutation, storyId],
  );

  const toggleLikeReply = useCallback(
    async (reply: StoryReply) => {
      try {
        await reactMutation.mutateAsync({ storyId, replyId: reply.id, type: "like" });
      } catch (error) {
        if (isAuthRequiredError(error)) onRequireAuth();
      }
    },
    [onRequireAuth, reactMutation, storyId],
  );

  const myAvatarUri = myProfile?.avatar_url?.trim() || null;
  const myLabel =
    `${myProfile?.first_name?.trim() ?? ""} ${myProfile?.last_name?.trim() ?? ""}`.trim() || "Me";

  const renderItem = useCallback(
    ({ item }: { item: StoryComment }) => (
      <StoryDiscussionCommentThread
        palette={palette}
        comment={item}
        replyTarget={replyTarget}
        inlineValue={inlineReplyText}
        inlineSubmitting={replyThreadMutation.isPending}
        onChangeInline={setInlineReplyText}
        onSubmitInline={() => void submitInlineReply()}
        onCloseInline={() => setReplyTarget(null)}
        onOpenReplyToComment={() => {
          setReplyTarget({
            anchorKey: `c-${item.id}`,
            rootCommentId: item.id,
            mentionTag: profileMentionTag(item.profile),
          });
        }}
        onOpenReplyToReply={(reply) => {
          setReplyTarget({
            anchorKey: `r-${reply.id}`,
            rootCommentId: item.id,
            mentionTag: profileMentionTag(reply.profile),
          });
        }}
        onToggleLikeComment={() => void toggleLikeComment(item)}
        onToggleLikeReply={(reply) => void toggleLikeReply(reply)}
      />
    ),
    [
      inlineReplyText,
      palette,
      replyTarget,
      replyThreadMutation.isPending,
      submitInlineReply,
      toggleLikeComment,
      toggleLikeReply,
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

  return (
    <View style={styles.flex}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        extraData={[replyTarget, inlineReplyText, replyThreadMutation.isPending, sorted, palette]}
        contentContainerStyle={[styles.listContent, listContentStyle]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.textMuted }]}>No comments yet. Be the first to reply.</Text>
        }
        style={styles.list}
        onContentSizeChange={(w, h) => onListContentSizeChange?.(w, h)}
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
        {showEmojiRow ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
            {QUICK_EMOJI.map((em) => (
              <Pressable key={em} hitSlop={4} style={styles.emojiChip} onPress={() => setMainDraft((s) => s + em)}>
                <Text style={styles.emojiText}>{em}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.footerInputRow}>
          {myAvatarUri ? (
            <SmartImage uri={myAvatarUri} recyclingKey={myAvatarUri} style={styles.footerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.footerAvatarFallback, { backgroundColor: palette.avatarFallback }]}>
              <Text style={[styles.footerAvatarLetter, { color: palette.text }]}>
                {myLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.footerInputWrap}>
            <RichTextarea
              value={mainDraft}
              onChangeText={setMainDraft}
              placeholder="Join the conversation..."
              placeholderTextColor={palette.textMuted}
              textAlignVertical="center"
              editable={!replyMutation.isPending}
              style={[styles.footerInput, { backgroundColor: palette.inputBg, color: palette.text }]}
            />
            <Pressable style={styles.footerGifBtn} onPress={() => {}}>
              <Text style={[styles.footerGifText, { color: palette.textMuted }]}>GIF</Text>
            </Pressable>
            <Pressable
              style={[
                styles.footerSendCircle,
                { backgroundColor: palette.sendAccent },
                (!mainDraft.trim() || replyMutation.isPending) && styles.footerSendCircleDisabled,
              ]}
              disabled={!mainDraft.trim() || replyMutation.isPending}
              onPress={() => void submitMainComment()}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
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
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
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
    marginTop: 20,
    paddingHorizontal: 12,
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
    paddingRight: 108,
    paddingVertical: 10,
    fontSize: 14,
  },
  footerGifBtn: {
    position: "absolute",
    right: 44,
    bottom: 10,
  },
  footerGifText: {
    fontSize: 14,
    fontWeight: "600",
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
