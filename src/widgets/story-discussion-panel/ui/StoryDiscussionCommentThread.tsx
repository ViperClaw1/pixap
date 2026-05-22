import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StoryComment, StoryReply } from "@/entities/story";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import type { DiscussionUiPalette } from "@/shared/theme/discussionPalette";
import { formatStoryDiscussionTime } from "@/shared/lib/formatRelativeTime";
import { profileDisplayName } from "../lib/storyDiscussionMention";

const AVATAR = 32;
export const THREAD_INDENT = 42;

export type ReplyComposerTarget = {
  anchorKey: string;
  rootCommentId: string;
  mentionTag: string;
};

type Props = {
  palette: DiscussionUiPalette;
  comment: StoryComment;
  replyTarget: ReplyComposerTarget | null;
  inlineValue: string;
  inlineSubmitting: boolean;
  onChangeInline: (text: string) => void;
  onSubmitInline: () => void;
  onCloseInline: () => void;
  onOpenReplyToComment: () => void;
  onOpenReplyToReply: (reply: StoryReply) => void;
  onToggleLikeComment: () => void;
  onToggleLikeReply: (reply: StoryReply) => void;
};

function Avatar({ uri, label, palette }: { uri: string | null; label: string; palette: DiscussionUiPalette }) {
  const letter = label.charAt(0).toUpperCase();
  const displayUri = getAvatarDisplayUrl(uri, { layoutPx: AVATAR });
  if (displayUri) {
    return (
      <SmartImage
        uri={displayUri}
        fallbackUri={uri && uri !== displayUri ? uri : undefined}
        recyclingKey={displayUri}
        style={styles.avatar}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { backgroundColor: palette.avatarFallback }]}>
      <Text style={[styles.avatarFallbackText, { color: palette.text }]}>{letter}</Text>
    </View>
  );
}

export function StoryDiscussionCommentThread({
  palette,
  comment,
  replyTarget,
  inlineValue,
  inlineSubmitting,
  onChangeInline,
  onSubmitInline,
  onCloseInline,
  onOpenReplyToComment,
  onOpenReplyToReply,
  onToggleLikeComment,
  onToggleLikeReply,
}: Props) {
  const name = profileDisplayName(comment.profile);
  const time = formatStoryDiscussionTime(comment.created_at);
  const showComposerAfterComment = replyTarget?.anchorKey === `c-${comment.id}`;

  return (
    <View style={styles.thread}>
      <View style={styles.row}>
        <Avatar uri={comment.profile?.avatar_url ?? null} label={name} palette={palette} />
        <View style={styles.mid}>
          <Text style={styles.nameLine}>
            <Text style={[styles.nameBold, { color: palette.text }]}>{name}</Text>
            {time ? <Text style={[styles.timeInline, { color: palette.textMuted }]}> {time}</Text> : null}
          </Text>
          <Text style={[styles.body, { color: palette.text }]}>{comment.content}</Text>
          <Pressable hitSlop={6} onPress={onOpenReplyToComment} style={styles.replyBtn}>
            <Text style={[styles.replyLabel, { color: palette.textMuted }]}>Reply</Text>
          </Pressable>
        </View>
        <View style={styles.likeCol}>
          <Pressable hitSlop={8} onPress={onToggleLikeComment} style={styles.likeHit}>
            <AnimatedLikeHeart
              liked={comment.liked_by_me}
              size={13}
              color={palette.text}
              likedColor={palette.likeAccent}
            />
          </Pressable>
          {comment.like_count > 0 ? (
            <Text style={[styles.likeCount, { color: palette.textMuted }]}>{comment.like_count}</Text>
          ) : null}
        </View>
      </View>

      {showComposerAfterComment ? (
        <View style={styles.composerIndent}>
          <View style={styles.replyingBar}>
            <Text style={[styles.replyingText, { color: palette.textMuted }]} numberOfLines={1}>
              Replying to {profileDisplayName(comment.profile)}
            </Text>
            <Pressable hitSlop={8} onPress={onCloseInline}>
              <Ionicons name="close" size={18} color={palette.textMuted} />
            </Pressable>
          </View>
          <View style={styles.inlineInputShell}>
            <RichTextarea
              value={inlineValue}
              onChangeText={onChangeInline}
              placeholder="Add a reply…"
              placeholderTextColor={palette.textMuted}
              textAlignVertical="center"
              editable={!inlineSubmitting}
              style={[styles.inlineInput, { backgroundColor: palette.inputBg, color: palette.text }]}
            />
            <Pressable
              style={[
                styles.sendCircle,
                { backgroundColor: palette.sendAccent },
                (!inlineValue.trim() || inlineSubmitting) && styles.sendCircleDisabled,
              ]}
              disabled={!inlineValue.trim() || inlineSubmitting}
              onPress={onSubmitInline}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {comment.replies.map((reply) => {
        const rName = profileDisplayName(reply.profile);
        const rTime = formatStoryDiscussionTime(reply.created_at);
        const showComposerAfterReply = replyTarget?.anchorKey === `r-${reply.id}`;

        return (
          <View key={reply.id}>
            <View style={[styles.row, styles.replyRow]}>
              <Avatar uri={reply.profile?.avatar_url ?? null} label={rName} palette={palette} />
              <View style={styles.mid}>
                <Text style={styles.nameLine}>
                  <Text style={[styles.nameBold, { color: palette.text }]}>{rName}</Text>
                  {rTime ? <Text style={[styles.timeInline, { color: palette.textMuted }]}> {rTime}</Text> : null}
                </Text>
                <Text style={[styles.body, { color: palette.text }]}>{reply.content}</Text>
                <Pressable
                  hitSlop={6}
                  onPress={() => onOpenReplyToReply(reply)}
                  style={styles.replyBtn}
                >
                  <Text style={[styles.replyLabel, { color: palette.textMuted }]}>Reply</Text>
                </Pressable>
              </View>
              <View style={styles.likeCol}>
                <Pressable hitSlop={8} onPress={() => onToggleLikeReply(reply)} style={styles.likeHit}>
                  <AnimatedLikeHeart
                    liked={reply.liked_by_me}
                    size={13}
                    color={palette.text}
                    likedColor={palette.likeAccent}
                  />
                </Pressable>
                {reply.like_count > 0 ? (
                  <Text style={[styles.likeCount, { color: palette.textMuted }]}>{reply.like_count}</Text>
                ) : null}
              </View>
            </View>

            {showComposerAfterReply ? (
              <View style={[styles.composerIndent, { marginLeft: THREAD_INDENT }]}>
                <View style={styles.replyingBar}>
                  <Text style={[styles.replyingText, { color: palette.textMuted }]} numberOfLines={1}>
                    Replying to {profileDisplayName(reply.profile)}
                  </Text>
                  <Pressable hitSlop={8} onPress={onCloseInline}>
                    <Ionicons name="close" size={18} color={palette.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.inlineInputShell}>
                  <RichTextarea
                    value={inlineValue}
                    onChangeText={onChangeInline}
                    placeholder="Add a reply…"
                    placeholderTextColor={palette.textMuted}
                    textAlignVertical="center"
                    editable={!inlineSubmitting}
                    style={[styles.inlineInput, { backgroundColor: palette.inputBg, color: palette.text }]}
                  />
                  <Pressable
                    style={[
                      styles.sendCircle,
                      { backgroundColor: palette.sendAccent },
                      (!inlineValue.trim() || inlineSubmitting) && styles.sendCircleDisabled,
                    ]}
                    disabled={!inlineValue.trim() || inlineSubmitting}
                    onPress={onSubmitInline}
                  >
                    <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  replyRow: {
    marginLeft: THREAD_INDENT,
    marginTop: 8,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 14,
    fontWeight: "700",
  },
  mid: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  nameBold: {
    fontSize: 13,
    fontWeight: "700",
  },
  timeInline: {
    fontSize: 13,
    fontWeight: "400",
  },
  body: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1,
  },
  replyBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  likeCol: {
    width: 28,
    alignItems: "center",
    paddingTop: 2,
  },
  likeHit: {
    paddingVertical: 2,
  },
  likeCount: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  composerIndent: {
    marginTop: 8,
    marginLeft: THREAD_INDENT,
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  replyingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    marginRight: 8,
  },
  inlineInputShell: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 0,
    minHeight: 40,
    maxHeight: 120,
    paddingLeft: 14,
    paddingRight: 48,
    paddingVertical: 9,
    fontSize: 14,
  },
  sendCircle: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleDisabled: {
    opacity: 0.45,
  },
});
