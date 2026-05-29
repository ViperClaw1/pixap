import { memo, useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { StoryReactionType } from "@/shared/model/types/stories";
import type { FeedStoryItem } from "@/entities/story";
import { isAuthRequiredError } from "@/shared/lib/auth/authRequired";
import { ReactionBar } from "./ReactionBar";
import { CommentPreview } from "./CommentPreview";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { getFeedStoryPreviewImageUrl } from "@/shared/lib/feedMediaUrls";
import { UgcModerationOverflow } from "@/features/ugc-moderation";
import { useAuth } from "@/app/providers/AuthProvider";
import { navigateToPublicProfile } from "@/app/navigation/navigationHelpers";

interface FeedStoryCardProps {
  story: FeedStoryItem;
  canFollow: boolean;
  followPending: boolean;
  onPressStory: () => void;
  onPressComments: () => void;
  onPressUser?: () => void;
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
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(story.my_reaction);
  const [localReactionCount, setLocalReactionCount] = useState(story.reaction_count);

  const fullName = useMemo(() => {
    const first = story.profile?.first_name?.trim() ?? "";
    const last = story.profile?.last_name?.trim() ?? "";
    return `${first} ${last}`.trim() || "Unknown User";
  }, [story.profile?.first_name, story.profile?.last_name]);
  const coverImage = useMemo(
    () => (story.media_url ? getFeedStoryPreviewImageUrl(story.media_url) : ""),
    [story.media_url],
  );
  const avatarRaw = story.profile?.avatar_url?.trim() || "";
  const avatarUri = useMemo(
    () => getAvatarDisplayUrl(avatarRaw, { layoutPx: 40 }) ?? "",
    [avatarRaw],
  );
  const coverBlurhash = story.media_blurhashes?.find((h): h is string => typeof h === "string" && h.length > 0);

  const handlePressUser = useCallback(() => {
    if (onPressUser) {
      onPressUser();
      return;
    }
    if (story.user_id) {
      navigateToPublicProfile(navigation, story.user_id);
    }
  }, [navigation, onPressUser, story.user_id]);

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
    <Pressable style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onPressStory}>
      <View style={styles.header}>
        <Pressable style={styles.userRow} onPress={handlePressUser}>
          <View style={[styles.avatar, { borderColor: colors.border }]}>
            {story.profile?.avatar_url ? (
              <SmartImage
                uri={avatarUri}
                fallbackUri={avatarRaw && avatarRaw !== avatarUri ? avatarRaw : undefined}
                style={styles.avatarImage}
                contentFit="cover"
                skipBundledPlaceholder
              />
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
                borderColor: story.is_followed_author ? colors.border : colors.accent,
                backgroundColor: story.is_followed_author ? colors.card : colors.accent,
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
        <UgcModerationOverflow
          hidden={!story.user_id || story.user_id === user?.id}
          subject={{
            targetType: "story",
            targetId: story.id,
            reportedUserId: story.user_id,
            authorLabel: fullName,
          }}
        />
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{story.content}</Text>

      {story.media_url ? (
        <SmartImage
          uri={coverImage || story.media_url}
          fallbackUri={story.media_url}
          blurhash={coverBlurhash}
          style={styles.media}
          contentFit="cover"
          transition={150}
          priority="normal"
        />
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontSize: 15,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  followText: {
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
  },
  media: {
    width: "100%",
    height: 210,
    borderRadius: 14,
  },
});
