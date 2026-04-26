import { useMemo } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { BrowseFlowParamList } from "@/navigation/types";
import type { StoryGroup, StoryReactionType } from "@/types/stories";
import { useStoriesFeed, type FeedStoryItem } from "@/hooks/useStoriesFeed";
import { useReactToStory } from "@/hooks/useReactToStory";
import { useToggleFollow } from "@/hooks/useUserFollows";
import { useAuth } from "@/contexts/AuthContext";
import { navigateToAuthScreen } from "@/lib/authRequired";
import { FeedList } from "@/components/stories/FeedList";

type FeedNav = NativeStackNavigationProp<BrowseFlowParamList>;

export default function StoriesFeedScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation<FeedNav>();
  const {
    stories,
    isLoading,
    isFetching,
    hasMore,
    loadMore,
    refetch,
    resetFeed,
  } = useStoriesFeed();
  const reactMutation = useReactToStory();
  const followMutation = useToggleFollow();
  const onAuthRequired = () => navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);

  const groupedStories = useMemo(() => {
    const grouped = new Map<string, StoryGroup>();
    for (const story of stories) {
      const existing = grouped.get(story.user_id);
      if (existing) {
        existing.stories.push(story);
      } else {
        grouped.set(story.user_id, {
          user_id: story.user_id,
          profile: story.profile,
          stories: [story],
        });
      }
    }
    return Array.from(grouped.values());
  }, [stories]);

  const onPressStory = (story: FeedStoryItem) => {
    const groupIndex = groupedStories.findIndex((group) => group.user_id === story.user_id);
    const group = groupedStories[groupIndex];
    const storyIndex = group?.stories.findIndex((item) => item.id === story.id) ?? -1;
    if (groupIndex < 0 || storyIndex < 0) return;

    navigation.navigate("StoryViewer", {
      groups: groupedStories,
      initialGroupIndex: groupIndex,
      initialStoryIndex: storyIndex,
      placeId: story.place_id,
    });
  };

  const onPressComments = (story: FeedStoryItem) => {
    navigation.navigate("StoryDiscussion", {
      storyId: story.id,
      placeId: story.place_id,
    });
  };

  const onPressUser = () => {
    Alert.alert("Profile view", "User profile route is not available yet in this flow.");
  };

  const onToggleFollow = async (story: FeedStoryItem) => {
    await followMutation.mutateAsync({
      followingId: story.user_id,
      isFollowing: story.is_followed_author,
    });
  };

  const onReact = async (story: FeedStoryItem, type: StoryReactionType) => {
    await reactMutation.mutateAsync({
      storyId: story.id,
      type,
    });
  };

  const onRefresh = () => {
    resetFeed();
    void refetch();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.root}>
        <FeedList
          stories={stories}
          loading={isLoading}
          refreshing={isFetching && !isLoading}
          hasMore={hasMore}
          followPending={followMutation.isPending}
          currentUserId={user?.id ?? null}
          onRefresh={onRefresh}
          onLoadMore={loadMore}
          onPressStory={onPressStory}
          onPressComments={onPressComments}
          onPressUser={onPressUser}
          onToggleFollow={onToggleFollow}
          onReact={onReact}
          onAuthRequired={onAuthRequired}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
