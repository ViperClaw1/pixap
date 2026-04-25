import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";

interface CommentPreviewProps {
  comments: Array<{ id: string; content: string }>;
  commentCount: number;
  onPressComments: () => void;
}

function CommentPreviewComponent({ comments, commentCount, onPressComments }: CommentPreviewProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      {comments.length ? (
        comments.map((comment) => (
          <Text key={comment.id} style={[styles.commentText, { color: colors.textMuted }]} numberOfLines={2}>
            {comment.content}
          </Text>
        ))
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No comments yet</Text>
      )}
      <Pressable onPress={onPressComments}>
        <Text style={[styles.link, { color: colors.primary }]}>
          {commentCount > 0 ? `View all ${commentCount} comments` : "Start discussion"}
        </Text>
      </Pressable>
    </View>
  );
}

export const CommentPreview = memo(CommentPreviewComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 6,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 12,
  },
  link: {
    fontSize: 13,
    fontWeight: "700",
  },
});
