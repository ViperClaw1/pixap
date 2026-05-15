import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { runOnJS } from "react-native-reanimated";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useStoryViewer } from "@/entities/story";
import { useStoryProgress } from "@/entities/story";
import { useReactToStory } from "@/entities/story";
import { useReplyToStory } from "@/entities/story";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import type { StoryItem, StoryReactionType } from "@/shared/model/types/stories";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StorySlide } from "@/widgets/stories-strip";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import Toast from "react-native-toast-message";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { StoryDiscussionGlassSheet } from "./StoryDiscussionGlassSheet";

type StoryViewerRoute = RouteProp<BrowseFlowParamList, "StoryViewer">;
type StoryViewerNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryViewer">;

const AUTO_ADVANCE_MS = 7000;
type FlatStoryRow = { story: StoryItem; groupIndex: number; storyIndex: number; key: string };

function formatStoryTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

function parseStoryMediaUrl(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item === "string" && item.trim().length > 0);
        return typeof first === "string" ? first : null;
      }
    } catch {
      return null;
    }
  }
  return value;
}

export default function StoryViewerScreen() {
  const { params } = useRoute<StoryViewerRoute>();
  const navigation = useNavigation<StoryViewerNav>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList<FlatStoryRow>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [quickComment, setQuickComment] = useState("");
  const viewer = useStoryViewer({
    groups: params.groups,
    initialGroupIndex: params.initialGroupIndex,
    initialStoryIndex: params.initialStoryIndex,
  });

  const activeStory = viewer.activeStory;
  const activeGroup = viewer.activeGroup;
  const storyId = activeStory?.id ?? "";
  const reactMutation = useReactToStory();
  const replyMutation = useReplyToStory();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(activeStory?.my_reaction ?? null);
  const authRedirectTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  useEffect(() => {
    if (!activeStory) return;
    setLocalReaction(activeStory.my_reaction);
  }, [activeStory]);

  useEffect(() => {
    return () => {
      authRedirectTaskRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const { goToNextStory, goToPreviousStory, goToNextGroup, goToPreviousGroup, setPaused } = viewer;
  const goNext = useCallback(() => {
    goToNextStory();
  }, [goToNextStory]);

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused: viewer.paused || keyboardOpen || discussionOpen,
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
    const next = parseStoryMediaUrl(viewer.flatStories[viewer.currentFlatIndex + 1]?.story.media_url);
    const nextGroup = parseStoryMediaUrl(params.groups[viewer.currentGroupIndex + 1]?.stories[0]?.media_url);
    const nextOptimized = getOptimizedImageUrl(next, 1080, 1920, 78) || next;
    const nextGroupOptimized = getOptimizedImageUrl(nextGroup, 1080, 1920, 78) || nextGroup;
    if (nextOptimized) void Image.prefetch(nextOptimized);
    if (nextGroupOptimized) void Image.prefetch(nextGroupOptimized);
  }, [params.groups, viewer.currentFlatIndex, viewer.currentGroupIndex, viewer.flatStories]);

  const closeViewerAndRouteToAuth = useCallback(() => {
    navigation.goBack();
    authRedirectTaskRef.current?.cancel();
    authRedirectTaskRef.current = InteractionManager.runAfterInteractions(() => {
      navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
    });
  }, [navigation]);

  const onReact = useCallback(
    async (type: StoryReactionType) => {
      if (!activeStory) return;
      const previousReaction = localReaction;
      const nextReaction = previousReaction === type ? null : type;
      setLocalReaction(nextReaction);
      try {
        await reactMutation.mutateAsync({ storyId: activeStory.id, type });
      } catch (error) {
        setLocalReaction(previousReaction);
        if (isAuthRequiredError(error)) {
          closeViewerAndRouteToAuth();
          return;
        }
        Alert.alert("Failed", error instanceof Error ? error.message : "Could not react to story");
      }
    },
    [activeStory, closeViewerAndRouteToAuth, localReaction, reactMutation],
  );

  const submitQuickComment = useCallback(async () => {
    if (!activeStory) return;
    const text = quickComment.trim();
    if (!text || replyMutation.isPending) return;
    try {
      await replyMutation.mutateAsync({ storyId: activeStory.id, content: text });
      setQuickComment("");
      Toast.show({ type: "success", text1: "Your comment was added" });
    } catch (error) {
      if (isAuthRequiredError(error)) {
        closeViewerAndRouteToAuth();
        return;
      }
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not send reply");
    }
  }, [activeStory, closeViewerAndRouteToAuth, quickComment, replyMutation]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event) => {
        if (event.x < width * 0.45) runOnJS(goToPreviousStory)();
        else runOnJS(goNext)();
      }),
    [goNext, goToPreviousStory, width],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(180)
        .onBegin(() => runOnJS(setPaused)(true))
        .onFinalize(() => runOnJS(setPaused)(false)),
    [setPaused],
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
          runOnJS(goToNextGroup)();
          return;
        }
        if (event.translationX > 70) {
          runOnJS(goToPreviousGroup)();
        }
      }),
    [goToNextGroup, goToPreviousGroup, navigation],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, Gesture.Exclusive(longPressGesture, tapGesture)),
    [longPressGesture, panGesture, tapGesture],
  );

  const contentHeight = Math.max(220, height - insets.top - insets.bottom - 320);
  const rawAuthorAvatar = activeStory?.profile?.avatar_url ?? activeGroup?.profile?.avatar_url ?? null;
  const authorAvatarUrl =
    typeof rawAuthorAvatar === "string" && rawAuthorAvatar.trim().length > 0 ? rawAuthorAvatar.trim() : null;
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
      edges={["top"]}
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
              },
            ]}
          >
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
            <View style={styles.mediaOverlayTop}>
              <View style={styles.sheetHandleWrap}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.progressWrap}>
                <StoryProgressBar
                  count={activeGroup.stories.length}
                  currentIndex={viewer.currentStoryIndex}
                  progress={progress}
                />
              </View>
            </View>

            <View
              style={[
                styles.bottomArea,
                {
                  backgroundColor: colors.card,
                  paddingBottom: 0,
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
                  <SmartImage
                    uri={authorAvatarUrl}
                    recyclingKey={authorAvatarUrl}
                    style={styles.authorAvatarImage}
                    contentFit="cover"
                    skipBundledPlaceholder
                  />
                ) : (
                  <View style={styles.authorAvatarPlaceholder} pointerEvents="none">
                    <Ionicons
                      name="person-outline"
                      size={32}
                      color={colors.text}
                      style={Platform.OS === "android" ? ({ includeFontPadding: false } as const) : undefined}
                    />
                  </View>
                )}
              </View>
              <View style={styles.authorMeta}>
                <Text style={[styles.authorNameText, { color: colors.text }]}>
                  {(activeGroup.profile?.first_name ?? "User").trim()}
                </Text>
                <Text style={[styles.authorDateText, { color: colors.textMuted }]}>
                  {formatStoryTime(activeStory.created_at)}
                </Text>
              </View>
              <Text style={[styles.postText, { color: "#000" }]} numberOfLines={6} ellipsizeMode="tail">
                {activeStory.content}
              </Text>
              <View style={styles.igComposerFooter}>
                <View style={[styles.igComposerRow, { paddingBottom: Math.max(10, Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0)) }]}>
                  <View style={styles.igInputWrap}>
                    <RichTextarea
                      value={quickComment}
                      onChangeText={setQuickComment}
                      placeholder="Send message..."
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      textAlignVertical="center"
                      editable={!replyMutation.isPending}
                      style={styles.igInput}
                    />
                  </View>
                  <View style={styles.igActions}>
                    <Pressable hitSlop={12} style={styles.igIconHit} onPress={() => void onReact("like")}>
                      <AnimatedLikeHeart
                        liked={localReaction === "like"}
                        size={26}
                        color="#FFFFFF"
                        likedColor="#F4212E"
                      />
                    </Pressable>
                    <Pressable hitSlop={12} style={styles.igIconHit} onPress={() => setDiscussionOpen(true)}>
                      <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      hitSlop={12}
                      style={styles.igIconHit}
                      onPress={() => void submitQuickComment()}
                      disabled={!quickComment.trim() || replyMutation.isPending}
                    >
                      <Ionicons
                        name="paper-plane-outline"
                        size={25}
                        color={quickComment.trim() && !replyMutation.isPending ? "#FFFFFF" : "rgba(255,255,255,0.35)"}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </GestureDetector>
      </KeyboardAvoidingView>

      <StoryDiscussionGlassSheet
        visible={discussionOpen}
        storyId={activeStory.id}
        navigation={navigation as unknown as NavigationProp<ParamListBase>}
        onDismiss={() => setDiscussionOpen(false)}
      />
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
  mediaOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    paddingTop: 4,
  },
  progressWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  sheetHandleWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 12,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    opacity: 0.9,
  },
  slider: {
    flexGrow: 0,
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
  authorAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  authorMeta: {
    marginTop: 8,
    marginBottom: 12,
  },
  authorNameText: {
    fontSize: 16,
    fontWeight: "700",
  },
  authorDateText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  igComposerFooter: {
    marginHorizontal: -14,
    marginTop: 8,
    backgroundColor: "#000000",
  },
  igComposerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#000000",
  },
  igInputWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "75%",
    minWidth: 0,
  },
  igInput: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ffffff",
    borderRadius: 999,
    color: "#FFFFFF",
    minHeight: 44,
    maxHeight: 96,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
  },
  igActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexShrink: 0,
    minHeight: 44,
  },
  igIconHit: {
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
