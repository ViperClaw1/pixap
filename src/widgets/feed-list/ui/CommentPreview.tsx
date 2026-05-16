import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";

export type CommentPreviewItem = {
  id: string;
  content: string;
  avatar_url?: string | null;
};

interface CommentPreviewProps {
  comments: CommentPreviewItem[];
  commentCount: number;
  onPressComments: () => void;
  showFooterLink?: boolean;
}

function commentAvatarUri(path?: string | null) {
  if (!path?.trim()) return null;
  return resolveStoragePublicUrl(path, "avatars");
}

function CommentPreviewComponent({
  comments,
  commentCount,
  onPressComments,
  showFooterLink = true,
}: CommentPreviewProps) {
  const { colors } = useAppTheme();

  if (!comments.length && !showFooterLink) return null;

  return (
    <View style={styles.container}>
      {comments.length ? (
        <View style={[styles.threadRail, { borderLeftColor: colors.border }]}>
          {comments.map((comment) => {
            const avatarUri = commentAvatarUri(comment.avatar_url);
            return (
              <View key={comment.id} style={styles.commentRow}>
                {avatarUri ? (
                  <SmartImage uri={avatarUri} style={styles.commentAvatar} contentFit="cover" recyclingKey={`comment-preview-${comment.id}`} />
                ) : (
                  <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder, { backgroundColor: colors.card }]}>
                    <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                  </View>
                )}
                <Text style={[styles.commentText, { color: colors.text }]} numberOfLines={1}>
                  {comment.content}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No comments yet</Text>
      )}
      {showFooterLink ? (
        <Pressable onPress={onPressComments}>
          <Text style={[styles.link, { color: colors.primary }]}>
            {commentCount > 0 ? `View all ${commentCount} comments` : "Start discussion"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const CommentPreview = memo(CommentPreviewComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    gap: 8,
  },
  threadRail: {
    marginLeft: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 8,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    flexShrink: 0,
  },
  commentAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  commentText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
  },
  emptyText: {
    fontSize: 12,
  },
  link: {
    fontSize: 13,
    fontWeight: "700",
  },
});
