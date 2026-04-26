import { memo, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryReactionType } from "@/types/stories";
import type { FeedStoryItem } from "@/hooks/useStoriesFeed";
import { isAuthRequiredError } from "@/lib/authRequired";
import { ReactionBar } from "./ReactionBar";
import { CommentPreview } from "./CommentPreview";

interface FeedStoryCardProps {
  story: FeedStoryItem;
  canFollow: boolean;
  followPending: boolean;
  onPressStory: () => void;
  onPressComments: () => void;
  onPressUser: () => void;
  onToggleFollow: (isCurrentlyFollowing: boolean) => Promise<void>;
  onReact: (type: StoryReactionType) => Promise<void>;
  onAuthRequired: () => void;
}

function FeedStoryCardComponent({
  story,
  canFollow,
  followPending,
  onPressStory,
  onPressComments,
  onPressUser,
  onToggleFollow,
  onReact,
  onAuthRequired,
}: FeedStoryCardProps) {
  const { colors } = useAppTheme();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(story.my_reaction);
  const [localReactionCount, setLocalReactionCount] = useState(story.reaction_count);

  const fullName = useMemo(() => {
    const first = story.profile?.first_name?.trim() ?? "";
    const last = story.profile?.last_name?.trim() ?? "";
    return `${first} ${last}`.trim() || "Unknown User";
  }, [story.profile?.first_name, story.profile?.last_name]);

  const onReactPress = async (type: StoryReactionType) => {
    const previousReaction = localReaction;
    const nextReaction = previousReaction === type ? null : type;
    setLocalReaction(nextReaction);
    setLocalReactionCount((prev) => {
      if (previousReaction === type) return Math.max(0, prev - 1);
      if (!previousReaction) return prev + 1;
      return prev;
    });

    try {
      await onReact(type);
    } catch (error) {
      setLocalReaction(previousReaction);
      setLocalReactionCount(story.reaction_count);
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Could not react", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const onFollowPress = async () => {
    try {
      await onToggleFollow(story.is_followed_author);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Could not follow", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <Pressable
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPressStory}
    >
      <View style={styles.header}>
        <Pressable style={styles.userRow} onPress={onPressUser}>
          <View style={[styles.avatar, { borderColor: colors.border }]}>
            {story.profile?.avatar_url ? (
              <Image source={{ uri: story.profile.avatar_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={[styles.avatarFallback, { color: colors.textMuted }]}>
                {fullName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
              {story.place_name}
            </Text>
          </View>
        </Pressable>

        {canFollow ? (
          <Pressable
            onPress={() => void onFollowPress()}
            disabled={followPending}
            style={[
              styles.followBtn,
              {
                borderColor: story.is_followed_author ? colors.border : colors.primary,
                backgroundColor: story.is_followed_author ? colors.card : colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.followText,
                { color: story.is_followed_author ? colors.text : colors.onPrimary },
              ]}
            >
              {story.is_followed_author ? "Following" : "Follow"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{story.content}</Text>

      {story.media_url ? (
        <Image source={{ uri: story.media_url }} style={styles.media} contentFit="cover" transition={150} />
      ) : null}

      <ReactionBar
        activeReaction={localReaction}
        reactionCount={localReactionCount}
        onReact={(type) => void onReactPress(type)}
      />

      <CommentPreview
        comments={story.comment_preview.map((item) => ({ id: item.id, content: item.content }))}
        commentCount={story.comment_count}
        onPressComments={onPressComments}
      />
    </Pressable>
  );
}

export const FeedStoryCard = memo(FeedStoryCardComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 14,
    fontWeight: "700",
  },
  userText: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
  },
  place: {
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  followText: {
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
  media: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
});
