import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StoryComment, StoryReply } from "@/entities/story";
import type { StoryDiscussionItemKind } from "@/entities/story/lib/storyCommentCachePatch";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import type { DiscussionUiPalette } from "@/shared/theme/discussionPalette";
import { formatStoryDiscussionTime } from "@/shared/lib/formatRelativeTime";
import { isOptimisticDiscussionId } from "@/shared/lib/discussionOptimisticId";
import { getVisibleDiscussionReplies, hasHiddenDiscussionReplies } from "@/shared/lib/discussionPagination";
import { DiscussionShowMoreButton } from "@/shared/ui/discussion-show-more/DiscussionShowMoreButton";
import { profileDisplayName } from "../lib/storyDiscussionMention";
import { UgcModerationOverflow } from "@/features/ugc-moderation";
import type { ModerationSubject } from "@/features/ugc-moderation";

const AVATAR = 32;
const ACTION_ICON_SIZE = 13;
export const THREAD_INDENT = 42;

export type ReplyComposerTarget = {
  rootCommentId: string;
  mentionTag: string;
  replyingToLabel: string;
};

type Props = {
  palette: DiscussionUiPalette;
  comment: StoryComment;
  currentUserId?: string | null;
  onOpenReplyToComment: () => void;
  onOpenReplyToReply: (reply: StoryReply) => void;
  onToggleLikeComment: () => void;
  onToggleLikeReply: (reply: StoryReply) => void;
  onEditComment: (itemId: string, content: string, kind: StoryDiscussionItemKind) => void;
  onDeleteComment: (itemId: string, kind: StoryDiscussionItemKind) => void;
  visibleReplyCount: number;
  onShowMoreReplies: () => void;
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

function ActionColumn({
  palette,
  isOwner,
  liked,
  likeCount,
  onEdit,
  onDelete,
  onToggleLike,
  moderationSubject,
}: {
  palette: DiscussionUiPalette;
  isOwner: boolean;
  liked: boolean;
  likeCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  moderationSubject?: ModerationSubject | null;
}) {
  return (
    <View style={styles.actionCol}>
      <View style={styles.actionIconsRow}>
        {isOwner ? (
          <>
            <Pressable hitSlop={8} style={styles.actionHit} onPress={onEdit} accessibilityLabel="Edit comment">
              <Ionicons name="create-outline" size={ACTION_ICON_SIZE} color={palette.textMuted} />
            </Pressable>
            <Pressable hitSlop={8} style={styles.actionHit} onPress={onDelete} accessibilityLabel="Delete comment">
              <Ionicons name="trash-outline" size={ACTION_ICON_SIZE} color={palette.textMuted} />
            </Pressable>
          </>
        ) : moderationSubject ? (
          <UgcModerationOverflow subject={moderationSubject} iconSize={ACTION_ICON_SIZE} hitSlop={6} />
        ) : null}
        <View style={styles.likeCol}>
          <Pressable hitSlop={8} style={styles.actionHit} onPress={onToggleLike} accessibilityLabel="Like comment">
            <AnimatedLikeHeart
              liked={liked}
              size={ACTION_ICON_SIZE}
              color={palette.text}
              likedColor={palette.likeAccent}
            />
          </Pressable>
          {likeCount > 0 ? (
            <Text style={[styles.likeCount, { color: palette.textMuted }]}>{likeCount}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function StoryDiscussionCommentThread({
  palette,
  comment,
  currentUserId,
  onOpenReplyToComment,
  onOpenReplyToReply,
  onToggleLikeComment,
  onToggleLikeReply,
  onEditComment,
  onDeleteComment,
  visibleReplyCount,
  onShowMoreReplies,
}: Props) {
  const name = profileDisplayName(comment.profile);
  const time = formatStoryDiscussionTime(comment.created_at);
  const isCommentOwner = Boolean(currentUserId && comment.user_id === currentUserId);
  const canReplyToComment = !isOptimisticDiscussionId(comment.id);
  const visibleReplies = getVisibleDiscussionReplies(comment.replies, visibleReplyCount);
  const showMoreReplies = hasHiddenDiscussionReplies(comment.replies.length, visibleReplyCount);

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
          {canReplyToComment ? (
            <Pressable hitSlop={6} onPress={onOpenReplyToComment} style={styles.replyBtn}>
              <Text style={[styles.replyLabel, { color: palette.textMuted }]}>Reply</Text>
            </Pressable>
          ) : null}
        </View>
        <ActionColumn
          palette={palette}
          isOwner={isCommentOwner}
          liked={comment.liked_by_me}
          likeCount={comment.like_count}
          onEdit={() => onEditComment(comment.id, comment.content, "comment")}
          onDelete={() => onDeleteComment(comment.id, "comment")}
          onToggleLike={onToggleLikeComment}
          moderationSubject={
            isCommentOwner
              ? null
              : {
                  targetType: "story_comment",
                  targetId: comment.id,
                  reportedUserId: comment.user_id,
                  authorLabel: name,
                }
          }
        />
      </View>

      {showMoreReplies ? (
        <DiscussionShowMoreButton
          label="Show more replies"
          onPress={onShowMoreReplies}
          palette={palette}
          style={styles.showMoreReplies}
        />
      ) : null}

      {visibleReplies.map((reply) => {
        const rName = profileDisplayName(reply.profile);
        const rTime = formatStoryDiscussionTime(reply.created_at);
        const isReplyOwner = Boolean(currentUserId && reply.user_id === currentUserId);
        const canReplyToReply = !isOptimisticDiscussionId(reply.id);

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
                {canReplyToReply ? (
                  <Pressable hitSlop={6} onPress={() => onOpenReplyToReply(reply)} style={styles.replyBtn}>
                    <Text style={[styles.replyLabel, { color: palette.textMuted }]}>Reply</Text>
                  </Pressable>
                ) : null}
              </View>
              <ActionColumn
                palette={palette}
                isOwner={isReplyOwner}
                liked={reply.liked_by_me}
                likeCount={reply.like_count}
                onEdit={() => onEditComment(reply.id, reply.content, "reply")}
                onDelete={() => onDeleteComment(reply.id, "reply")}
                onToggleLike={() => onToggleLikeReply(reply)}
                moderationSubject={
                  isReplyOwner
                    ? null
                    : {
                        targetType: "story_comment",
                        targetId: reply.id,
                        reportedUserId: reply.user_id,
                        authorLabel: rName,
                      }
                }
              />
            </View>
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
  showMoreReplies: {
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
  actionCol: {
    alignItems: "center",
    paddingTop: 2,
    minWidth: ACTION_ICON_SIZE,
  },
  actionIconsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  likeCol: {
    alignItems: "center",
    minWidth: ACTION_ICON_SIZE + 4,
  },
  actionHit: {
    width: ACTION_ICON_SIZE + 4,
    height: ACTION_ICON_SIZE + 4,
    alignItems: "center",
    justifyContent: "center",
  },
  likeCount: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "500",
  },
});
