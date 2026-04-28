import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { runOnJS } from "react-native-reanimated";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useStoryViewer } from "@/hooks/useStoryViewer";
import { useStoryProgress } from "@/hooks/useStoryProgress";
import { useReactToStory } from "@/hooks/useReactToStory";
import { useReplyToStory } from "@/hooks/useReplyToStory";
import { useStoryComments } from "@/hooks/useStoryComments";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import type { StoryItem, StoryReactionType } from "@/types/stories";
import { StorySlide } from "@/components/stories/StorySlide";
import { StoryProgressBar } from "@/components/stories/StoryProgressBar";
import { ReactionBar } from "@/components/stories/ReactionBar";
import { ReplyInput } from "@/components/stories/ReplyInput";

type StoryViewerRoute = RouteProp<BrowseFlowParamList, "StoryViewer">;
type StoryViewerNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryViewer">;

const AUTO_ADVANCE_MS = 7000;
type FlatStoryRow = { story: StoryItem; groupIndex: number; storyIndex: number; key: string };

function formatStoryTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

export default function StoryViewerScreen() {
  const { params } = useRoute<StoryViewerRoute>();
  const navigation = useNavigation<StoryViewerNav>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList<FlatStoryRow>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewer = useStoryViewer({
    groups: params.groups,
    initialGroupIndex: params.initialGroupIndex,
    initialStoryIndex: params.initialStoryIndex,
  });

  const activeStory = viewer.activeStory;
  const activeGroup = viewer.activeGroup;
  const storyId = activeStory?.id ?? "";
  const { data: comments = [] } = useStoryComments(storyId);
  const reactMutation = useReactToStory();
  const replyMutation = useReplyToStory();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(activeStory?.my_reaction ?? null);
  const [localReactionCount, setLocalReactionCount] = useState(activeStory?.reaction_count ?? 0);

  useEffect(() => {
    if (!activeStory) return;
    setLocalReaction(activeStory.my_reaction);
    setLocalReactionCount(activeStory.reaction_count);
  }, [activeStory]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const goNext = useCallback(() => {
    const moved = viewer.goToNextStory();
    if (!moved) navigation.goBack();
  }, [navigation, viewer]);

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused: viewer.paused || keyboardOpen,
    itemKey: storyId,
    onComplete: goNext,
  });

  useEffect(() => {
    flatListRef.current?.scrollToIndex({
      index: viewer.currentFlatIndex,
      animated: false,
    });
  }, [viewer.currentFlatIndex]);

  useEffect(() => {
    const next = viewer.flatStories[viewer.currentFlatIndex + 1]?.story.media_url;
    const nextGroup = params.groups[viewer.currentGroupIndex + 1]?.stories[0]?.media_url;
    if (next) void Image.prefetch(next);
    if (nextGroup) void Image.prefetch(nextGroup);
  }, [params.groups, viewer.currentFlatIndex, viewer.currentGroupIndex, viewer.flatStories]);

  const closeViewerAndRouteToAuth = useCallback(() => {
    navigation.goBack();
    setTimeout(() => {
      navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
    }, 0);
  }, [navigation]);

  const onReact = useCallback(
    async (type: StoryReactionType) => {
      if (!activeStory) return;
      const previousReaction = localReaction;
      const nextReaction = previousReaction === type ? null : type;
      setLocalReaction(nextReaction);
      setLocalReactionCount((prev) => {
        if (previousReaction === type) return Math.max(0, prev - 1);
        if (!previousReaction) return prev + 1;
        return prev;
      });
      try {
        await reactMutation.mutateAsync({ storyId: activeStory.id, type });
      } catch (error) {
        setLocalReaction(previousReaction);
        setLocalReactionCount(activeStory.reaction_count);
        if (isAuthRequiredError(error)) {
          closeViewerAndRouteToAuth();
          return;
        }
        Alert.alert("Failed", error instanceof Error ? error.message : "Could not react to story");
      }
    },
    [activeStory, closeViewerAndRouteToAuth, localReaction, reactMutation],
  );

  const onReply = useCallback(
    async (value: string) => {
      if (!activeStory) return;
      try {
        await replyMutation.mutateAsync({ storyId: activeStory.id, content: value });
      } catch (error) {
        if (isAuthRequiredError(error)) {
          closeViewerAndRouteToAuth();
          return;
        }
        Alert.alert("Failed", error instanceof Error ? error.message : "Could not send reply");
      }
    },
    [activeStory, closeViewerAndRouteToAuth, replyMutation],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event) => {
        if (event.x < width * 0.45) runOnJS(viewer.goToPreviousStory)();
        else runOnJS(goNext)();
      }),
    [goNext, viewer, width],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(180)
        .onBegin(() => runOnJS(viewer.setPaused)(true))
        .onFinalize(() => runOnJS(viewer.setPaused)(false)),
    [viewer],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan().onEnd((event) => {
        const isVerticalDismiss = event.translationY > 100 && Math.abs(event.translationY) > Math.abs(event.translationX);
        if (isVerticalDismiss) {
          runOnJS(navigation.goBack)();
          return;
        }
        if (event.translationX < -70) {
          runOnJS(viewer.goToNextGroup)();
          return;
        }
        if (event.translationX > 70) {
          runOnJS(viewer.goToPreviousGroup)();
        }
      }),
    [navigation, viewer],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, Gesture.Exclusive(longPressGesture, tapGesture)),
    [longPressGesture, panGesture, tapGesture],
  );

  const contentHeight = Math.max(220, height - insets.top - insets.bottom - 320);
  const authorName = (activeStory?.profile?.first_name ?? activeGroup?.profile?.first_name ?? "U").trim();
  const authorAvatarUrl = activeStory?.profile?.avatar_url ?? activeGroup?.profile?.avatar_url ?? null;
  const authorAvatarSize = Math.max(64, Math.min(92, Math.round(contentHeight * 0.18)));
  const authorAvatarRadius = authorAvatarSize / 2;

  if (!activeStory || !activeGroup) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={Platform.OS === "ios" ? ["top", "bottom"] : ["top"]}
      >
        <View style={styles.emptyWrap}>
          <Text style={{ color: colors.text }}>No stories available.</Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.primary, marginTop: 12, fontWeight: "700" }}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: "rgba(0,0,0,0.45)" }]}
      edges={Platform.OS === "ios" ? ["top", "bottom"] : ["top"]}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Math.max(insets.top, 8)}
      >
        <GestureDetector gesture={composedGesture}>
          <View
            style={[
              styles.gestureSurface,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                marginTop: 10,
              },
            ]}
          >
            <View style={styles.topArea}>
              <StoryProgressBar
                count={activeGroup.stories.length}
                currentIndex={viewer.currentStoryIndex}
                progress={progress}
              />
              <View style={styles.headerRow}>
                <Text style={[styles.headerText, { color: colors.text }]}>
                  {(activeGroup.profile?.first_name ?? "User").trim()}
                </Text>
                <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatStoryTime(activeStory.created_at)}</Text>
              </View>
            </View>

            <FlatList
              ref={flatListRef}
              horizontal
              pagingEnabled
              data={viewer.flatStories}
              scrollEnabled={false}
              keyExtractor={(item) => item.key}
              getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
              initialScrollIndex={viewer.currentFlatIndex}
              renderItem={({ item }) => <StorySlide story={item.story} width={width} height={contentHeight} />}
              style={styles.slider}
              removeClippedSubviews
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
            />

            <View
              style={[
                styles.bottomArea,
                {
                  backgroundColor: colors.card,
                  paddingBottom: Platform.OS === "ios" ? Math.max(8, insets.bottom) : 8,
                  paddingTop: Math.max(38, Math.round(authorAvatarSize * 0.55)),
                },
              ]}
            >
              <View
                style={[
                  styles.authorAvatarWrap,
                  {
                    top: -authorAvatarRadius,
                    left: 16,
                    width: authorAvatarSize,
                    height: authorAvatarSize,
                    borderRadius: authorAvatarRadius,
                    borderColor: colors.card,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {authorAvatarUrl ? (
                  <Image source={{ uri: authorAvatarUrl }} style={styles.authorAvatarImage} contentFit="cover" />
                ) : (
                  <Text style={[styles.authorAvatarFallback, { color: colors.text }]}>{authorName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <Text style={[styles.postText, { color: "#000" }]} numberOfLines={6} ellipsizeMode="tail">
                {activeStory.content}
              </Text>
              <ReactionBar
                activeReaction={localReaction}
                reactionCount={localReactionCount}
                onReact={(type) => void onReact(type)}
              />
              <Text style={[styles.replyCount, { color: colors.textMuted }]}>{comments.length} replies</Text>
              <Pressable
                onPress={() => navigation.navigate("StoryDiscussion", { storyId: activeStory.id, placeId: params.placeId })}
              >
                <Text style={[styles.discussionLink, { color: colors.primary }]}>View discussion</Text>
              </Pressable>
              <ReplyInput submitting={replyMutation.isPending} onSubmit={onReply} />
            </View>
          </View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gestureSurface: {
    flex: 1,
    overflow: "hidden",
  },
  topArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    fontSize: 14,
    fontWeight: "700",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  slider: {
    flexGrow: 0,
    marginTop: 10,
  },
  bottomArea: {
    paddingHorizontal: 14,
    paddingTop: 44,
    paddingBottom: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    zIndex: 3,
  },
  authorAvatarWrap: {
    position: "absolute",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 5,
  },
  authorAvatarImage: {
    width: "100%",
    height: "100%",
  },
  authorAvatarFallback: {
    fontSize: 24,
    fontWeight: "700",
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  replyCount: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  discussionLink: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
