import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InteractionManager,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextInput
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { animateStoryViewerDismissWorklet } from "@/shared/lib/storyViewerDismissAnimation";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useStoryViewer } from "@/entities/story";
import { buildMediaSlidesForStory } from "@/entities/story/lib/buildStoryMediaSlides";
import { useStoryProgress } from "@/entities/story";
import { useReactToStory } from "@/entities/story";
import { useReplyToStory } from "@/entities/story";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import type { StoryReactionType } from "@/shared/model/types/stories";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryMediaSlide } from "@/widgets/stories-strip";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import { getFeedStoryFullscreenImageUrl } from "@/shared/lib/feedMediaUrls";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { StoryDiscussionGlassSheet } from "./StoryDiscussionGlassSheet";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

type StoryMediaSlideItem = ReturnType<typeof buildMediaSlidesForStory>[number];

type StoryViewerRoute = RouteProp<BrowseFlowParamList, "StoryViewer">;
type StoryViewerNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryViewer">;

const AUTO_ADVANCE_MS = 7000;
/** Matches `igComposerRow` Android paddingBottom — keep in sync. */
const COMPOSER_FOOTER_PADDING_ANDROID = 10;
/** Lifts composer above keyboard on Android (footer padding + buffer). */
const COMPOSER_ANDROID_KEYBOARD_GAP = COMPOSER_FOOTER_PADDING_ANDROID + 35;
/** Min downward drag (px) before dismiss. */
const DISMISS_DRAG_PX = 100;

function formatStoryTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

export default function StoryViewerScreen() {
  const { params } = useRoute<StoryViewerRoute>();
  const navigation = useNavigation<StoryViewerNav>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions(); // orientation-aware by design (fullscreen story media)
  const flatListRef = useRef<FlashListRef<StoryMediaSlideItem>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const frozenLayoutHeightRef = useRef(height);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [mediaSlideIndex, setMediaSlideIndex] = useState(0);
  const enteringPreviousStoryRef = useRef(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [quickComment, setQuickComment] = useState("");
  const viewerGroups = params.groups ?? [];
  const viewerInitialGroupIndex = params.initialGroupIndex ?? 0;
  const viewerInitialStoryIndex = params.initialStoryIndex ?? 0;
  const viewer = useStoryViewer({
    groups: viewerGroups,
    initialGroupIndex: viewerInitialGroupIndex,
    initialStoryIndex: viewerInitialStoryIndex,
  });

  const activeStory = viewer.activeStory;
  const activeGroup = viewer.activeGroup;
  const storyId = activeStory?.id ?? "";
  const reactMutation = useReactToStory();
  const replyMutation = useReplyToStory();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(activeStory?.my_reaction ?? null);
  const authRedirectTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const isDismissingRef = useRef(false);
  const dismissTranslateY = useSharedValue(0);

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
    if (Platform.OS !== "android") return;
    if (!keyboardOpen) {
      frozenLayoutHeightRef.current = height;
    }
  }, [height, keyboardOpen]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const androidKeyboardInset = useKeyboardInset({
    gap: 0,
    ignoreWindowResize: true,
    enabled: Platform.OS === "android",
    onKeyboardChange: (_keyboardTop, keyboardHeight) => {
      setKeyboardOpen(keyboardHeight > 0);
    },
  });

  const androidBottomLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -androidKeyboardInset.value }],
  }));

  const dismissDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissTranslateY.value }],
  }));

  const dismissScrimStyle = useAnimatedStyle(() => {
    const fadeDistance = Math.max(height * 0.35, 1);
    const progress = Math.min(1, dismissTranslateY.value / fadeDistance);
    return { opacity: 1 - progress };
  });

  const closeViewer = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    navigation.goBack();
  }, [navigation]);

  const { goToNextStory, goToPreviousStory, goToNextGroup, goToPreviousGroup, setPaused } = viewer;

  const activeMediaSlides = useMemo(
    () => (activeStory ? buildMediaSlidesForStory(activeStory) : []),
    [activeStory],
  );

  useEffect(() => {
    if (!activeStory) return;
    if (enteringPreviousStoryRef.current) {
      enteringPreviousStoryRef.current = false;
      setMediaSlideIndex(Math.max(0, activeMediaSlides.length - 1));
      return;
    }
    setMediaSlideIndex(0);
  }, [activeMediaSlides.length, activeStory?.id]);

  const goNextMediaOrStory = useCallback(() => {
    if (mediaSlideIndex < activeMediaSlides.length - 1) {
      setMediaSlideIndex((index) => index + 1);
      return;
    }
    goToNextStory();
  }, [activeMediaSlides.length, goToNextStory, mediaSlideIndex]);

  const goPrevMediaOrStory = useCallback(() => {
    if (mediaSlideIndex > 0) {
      setMediaSlideIndex((index) => index - 1);
      return;
    }
    enteringPreviousStoryRef.current = true;
    goToPreviousStory();
  }, [goToPreviousStory, mediaSlideIndex]);

  const progressItemKey = activeMediaSlides[mediaSlideIndex]?.key ?? storyId;

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused: viewer.paused || keyboardOpen || discussionOpen,
    itemKey: progressItemKey,
    onComplete: goNextMediaOrStory,
  });

  useEffect(() => {
    if (!activeMediaSlides.length) return;
    const index = Math.min(mediaSlideIndex, activeMediaSlides.length - 1);
    flatListRef.current?.scrollToOffset({
      offset: width * index,
      animated: false,
    });
  }, [activeMediaSlides.length, activeStory?.id, mediaSlideIndex, width]);

  useEffect(() => {
    const nextSlide = activeMediaSlides[mediaSlideIndex + 1];
    const nextStory = viewerGroups[viewer.currentGroupIndex + 1]?.stories[0];
    const nextUri = nextSlide?.rawUri ?? null;
    const nextGroupUri = nextStory?.media_url ?? null;
    const nextOptimized = nextUri ? getFeedStoryFullscreenImageUrl(nextUri) || nextUri : null;
    const nextGroupOptimized = nextGroupUri ? getFeedStoryFullscreenImageUrl(nextGroupUri) || nextGroupUri : null;
    if (nextOptimized) void Image.prefetch(nextOptimized);
    if (nextGroupOptimized) void Image.prefetch(nextGroupOptimized);
  }, [activeMediaSlides, mediaSlideIndex, viewer.currentGroupIndex, viewerGroups]);

  const closeViewerAndRouteToAuth = useCallback(() => {
    navigation.goBack();
    authRedirectTaskRef.current?.cancel();
    authRedirectTaskRef.current = InteractionManager.runAfterInteractions(() => {
      navigateToAuthScreen(navigation);
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

    const storyId = activeStory.id;
    setQuickComment("");
    Keyboard.dismiss();
    setDiscussionOpen(true);

    try {
      await replyMutation.mutateAsync({ storyId, content: text });
    } catch (error) {
      setQuickComment(text);
      if (isAuthRequiredError(error)) {
        setDiscussionOpen(false);
        closeViewerAndRouteToAuth();
        return;
      }
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not send reply");
    }
  }, [activeStory, closeViewerAndRouteToAuth, quickComment, replyMutation]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event) => {
        if (event.x < width * 0.45) runOnJS(goPrevMediaOrStory)();
        else runOnJS(goNextMediaOrStory)();
      }),
    [goNextMediaOrStory, goPrevMediaOrStory, width],
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
      Gesture.Pan()
        .enabled(!discussionOpen && !keyboardOpen)
        .onBegin(() => {
          runOnJS(setPaused)(true);
        })
        .onUpdate((e) => {
          if (e.translationY > 0 && Math.abs(e.translationY) > Math.abs(e.translationX)) {
            dismissTranslateY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          const isVertical = Math.abs(e.translationY) > Math.abs(e.translationX);
          if (isVertical && e.translationY > 0) {
            const shouldClose =
              e.translationY > DISMISS_DRAG_PX || (e.translationY > 48 && e.velocityY > 700);
            if (shouldClose) {
              animateStoryViewerDismissWorklet(
                dismissTranslateY,
                height,
                e.translationY,
                e.velocityY,
                closeViewer,
              );
              return;
            }
            dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
            runOnJS(setPaused)(false);
            return;
          }
          if (e.translationX < -70) {
            runOnJS(goToNextGroup)();
          } else if (e.translationX > 70) {
            runOnJS(goToPreviousGroup)();
          }
          dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
          runOnJS(setPaused)(false);
        }),
    [
      closeViewer,
      discussionOpen,
      dismissTranslateY,
      goToNextGroup,
      goToPreviousGroup,
      height,
      keyboardOpen,
      setPaused,
    ],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, Gesture.Exclusive(longPressGesture, tapGesture)),
    [longPressGesture, panGesture, tapGesture],
  );

  const layoutHeight =
    Platform.OS === "android" && keyboardOpen ? frozenLayoutHeightRef.current : height;
  const contentHeight = Math.max(220, layoutHeight - insets.top - insets.bottom - 320);
  const rawAuthorAvatar = activeStory?.profile?.avatar_url ?? activeGroup?.profile?.avatar_url ?? null;
  const authorAvatarRaw =
    typeof rawAuthorAvatar === "string" && rawAuthorAvatar.trim().length > 0 ? rawAuthorAvatar.trim() : null;
  const authorAvatarSize = Math.max(64, Math.min(92, Math.round(contentHeight * 0.18)));
  const authorAvatarRadius = authorAvatarSize / 2;
  const authorAvatarDisplay = authorAvatarRaw
    ? getAvatarDisplayUrl(authorAvatarRaw, { layoutPx: authorAvatarSize })
    : null;

  const renderStorySlide = useCallback(
    ({ item }: { item: StoryMediaSlideItem }) => {
      const rawUri = item.rawUri;
      const optimized = rawUri ? getFeedStoryFullscreenImageUrl(rawUri) : null;
      return (
        <StoryMediaSlide
          optimizedUri={optimized || rawUri}
          fallbackUri={rawUri}
          recyclingKey={`story-viewer-${item.key}`}
          width={width}
          height={contentHeight}
        />
      );
    },
    [contentHeight, width],
  );

  if (!activeStory || !activeGroup) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.background }]}
        edges={Platform.OS === "ios" ? ["top", "bottom"] : ["top"]}
      >
        <View style={styles.emptyWrap}>
          <Text style={{ color: colors.text }}>No stories available.</Text>
          <AppPressable onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.primary, marginTop: 12, fontWeight: "700" }}>Close</Text>
          </AppPressable>
        </View>
      </SafeAreaView>
    );
  }

  const storySurface = (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.gestureSurface,
          {
            backgroundColor: colors.background,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
          },
          dismissDragStyle,
        ]}
      >
        <FlashList
          ref={flatListRef}
          horizontal
          pagingEnabled
          data={activeMediaSlides}
          estimatedItemSize={width}
          scrollEnabled={false}
          keyExtractor={(item) => item.key}
          initialScrollIndex={Math.min(mediaSlideIndex, Math.max(0, activeMediaSlides.length - 1))}
          renderItem={renderStorySlide}
          style={styles.slider}
          drawDistance={width * 2}
        />
        <View style={styles.mediaOverlayTop}>
          <View style={styles.sheetHandleWrap}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.progressWrap}>
            <StoryProgressBar
              count={Math.max(1, activeMediaSlides.length)}
              currentIndex={mediaSlideIndex}
              progress={progress}
            />
          </View>
        </View>

        {Platform.OS === "android" ? (
          <Animated.View
            style={[
              styles.bottomArea,
              {
                backgroundColor: colors.card,
                paddingBottom: 0,
                paddingTop: Math.max(38, Math.round(authorAvatarSize * 0.55)),
              },
              androidBottomLiftStyle,
            ]}
          >
            {renderBottomAreaContent()}
          </Animated.View>
        ) : (
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
            {renderBottomAreaContent()}
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );

  function renderBottomAreaContent() {
    return (
      <>
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
          {authorAvatarDisplay ? (
            <SmartImage
              uri={authorAvatarDisplay}
              fallbackUri={authorAvatarRaw && authorAvatarRaw !== authorAvatarDisplay ? authorAvatarRaw : undefined}
              recyclingKey={authorAvatarDisplay}
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
          <View
            style={[
              styles.igComposerRow,
              {
                paddingBottom: Math.max(
                  COMPOSER_FOOTER_PADDING_ANDROID,
                  Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0),
                ),
              },
            ]}
          >
            <View style={styles.igInputWrap}>
              <RichTextarea
                ref={composerInputRef}
                value={quickComment}
                onChangeText={setQuickComment}
                placeholder="Send message..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                textAlignVertical="center"
                editable={!replyMutation.isPending}
                onFocus={() => {
                  if (Platform.OS === "android") {
                    frozenLayoutHeightRef.current = height;
                  }
                }}
                style={styles.igInput}
              />
            </View>
            <View style={styles.igActions}>
              <AppPressable hitSlop={12} style={styles.igIconHit} onPress={() => void onReact("like")}>
                <AnimatedLikeHeart
                  liked={localReaction === "like"}
                  size={26}
                  color="#FFFFFF"
                  likedColor="#F4212E"
                />
              </AppPressable>
              <AppPressable hitSlop={12} style={styles.igIconHit} onPress={() => setDiscussionOpen(true)}>
                <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
              </AppPressable>
              <AppPressable
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
              </AppPressable>
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[styles.dismissScrim, dismissScrimStyle]}
      />
      <View style={styles.root}>{storySurface}</View>

      <StoryDiscussionGlassSheet
        visible={discussionOpen}
        storyId={activeStory.id}
        navigation={navigation}
        onDismiss={() => setDiscussionOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  dismissScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
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
