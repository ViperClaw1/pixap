import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useFocusedOverlapKeyboardInset, useKeyboardInset } from "@/shared/lib/keyboard";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useStoryProgress, useStoryViewer, useReplyToStory, useReactToStory } from "@/entities/story";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { preloadSmartImages, SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { StoryMediaSlide } from "@/widgets/stories-strip";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import Toast from "react-native-toast-message";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { parseStoryMediaPrimaryUrl, parseStoryMediaUrls } from "@/shared/lib/storyMediaUrls";
import type { StoryItem, StoryReactionType } from "@/shared/model/types/stories";
import { formatRelativeTime } from "@/shared/lib/formatRelativeTime";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";

type FeedStoryViewerRoute = RouteProp<BrowseFlowParamList, "FeedStoryViewer">;
type FeedStoryViewerNav = NativeStackNavigationProp<BrowseFlowParamList, "FeedStoryViewer">;

const AUTO_ADVANCE_MS = 5000;
/** Reference width for scaling `gap` passed to `useKeyboardInset`. */
const COMPOSER_GAP_REF_WIDTH_PX = 390;
/** Matches `styles.bottomComposer.paddingTop` — keep in sync when keyboard is closed on Android. */
const COMPOSER_FOOTER_PADDING_ANDROID = 12;
/** iOS: `keyboardWillChangeFrame` already tracks overlap tightly; small negative gap fine-tunes position. */
const COMPOSER_KEYBOARD_GAP_AT_REF_IOS = -30;
/** Clears input bottom + footer `paddingBottom` above the keyboard (matches top padding). */
const COMPOSER_ANDROID_KEYBOARD_GAP = COMPOSER_FOOTER_PADDING_ANDROID + 35;
const DOUBLE_TAP_MS = 260;

type FeedMediaSlide = {
  key: string;
  story: StoryItem;
  groupIndex: number;
  storyIndex: number;
  mediaIndex: number;
  rawUri: string | null;
};

function buildFlatMediaSlides(flatStories: { story: StoryItem; groupIndex: number; storyIndex: number }[]): FeedMediaSlide[] {
  return flatStories.flatMap((row) => {
    const urls = parseStoryMediaUrls(row.story.media_url);
    if (!urls.length) {
      return [
        {
          key: `${row.story.id}-0`,
          story: row.story,
          groupIndex: row.groupIndex,
          storyIndex: row.storyIndex,
          mediaIndex: 0,
          rawUri: parseStoryMediaPrimaryUrl(row.story.media_url),
        },
      ];
    }
    return urls.map((url, mediaIndex) => ({
      key: `${row.story.id}-${mediaIndex}`,
      story: row.story,
      groupIndex: row.groupIndex,
      storyIndex: row.storyIndex,
      mediaIndex,
      rawUri: url,
    }));
  });
}

export default function FeedStoryViewerPage() {
  const { params } = useRoute<FeedStoryViewerRoute>();
  const navigation = useNavigation<FeedStoryViewerNav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const composerKeyboardGap = useMemo(
    () => (COMPOSER_KEYBOARD_GAP_AT_REF_IOS / COMPOSER_GAP_REF_WIDTH_PX) * width,
    [width],
  );
  const composerFooterPaddingBottom = useMemo(
    () => (Platform.OS === "android" ? COMPOSER_FOOTER_PADDING_ANDROID : 10 + Math.max(insets.bottom, 8)),
    [insets.bottom],
  );
  const { isDark } = useAppTheme();
  const composerTheme = useMemo(
    () =>
      isDark
        ? {
            barBg: "#000000",
            text: "#FFFFFF",
            placeholder: "rgba(255,255,255,0.45)",
            border: "#FFFFFF",
            icon: "#FFFFFF",
            iconMuted: "rgba(255,255,255,0.35)",
          }
        : {
            barBg: "#FFFFFF",
            text: "#111111",
            placeholder: "rgba(0,0,0,0.45)",
            border: "#111111",
            icon: "#111111",
            iconMuted: "rgba(0,0,0,0.35)",
          },
    [isDark],
  );
  const carouselRef = useRef<ICarouselInstance | null>(null);
  const composerInputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const keyboardInsetAnim = useKeyboardInset({
    gap: composerKeyboardGap,
    enabled: Platform.OS === "ios",
    useNativeDriver: true,
    onKeyboardChange: (_keyboardTop, keyboardHeight) => {
      setKeyboardOpen(keyboardHeight > 0);
    },
  });

  const { extraInset: androidComposerLift, recalculate: recalculateAndroidComposerLift } =
    useFocusedOverlapKeyboardInset({
      gap: COMPOSER_ANDROID_KEYBOARD_GAP,
      getFocusedInput: () => composerInputRef.current,
      enabled: Platform.OS === "android",
      onKeyboardChange: (_keyboardTop, keyboardHeight) => {
        setKeyboardOpen(keyboardHeight > 0);
      },
    });

  const composerBarAnimatedStyle = useAnimatedStyle(() => {
    const lift = Platform.OS === "android" ? androidComposerLift.value : keyboardInsetAnim.value;
    if (Platform.OS === "android") {
      return {
        transform: [{ translateY: -lift }],
        paddingBottom: COMPOSER_FOOTER_PADDING_ANDROID,
      };
    }
    return {
      transform: [{ translateY: -lift }],
    };
  }, [androidComposerLift, keyboardInsetAnim]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastTapRef = useRef<{ ts: number; storyId: string } | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewer = useStoryViewer({
    groups: params.groups,
    initialGroupIndex: params.initialGroupIndex,
    initialStoryIndex: params.initialStoryIndex,
    loop: true,
  });

  const { flatStories, setCurrent, setPaused, paused } = viewer;

  const flatMediaSlides = useMemo(() => buildFlatMediaSlides(flatStories), [flatStories]);

  const defaultCarouselIndex = useMemo(() => {
    if (!flatMediaSlides.length) return 0;
    const idx = flatMediaSlides.findIndex(
      (s) => s.groupIndex === params.initialGroupIndex && s.storyIndex === params.initialStoryIndex,
    );
    return idx >= 0 ? idx : 0;
  }, [flatMediaSlides, params.initialGroupIndex, params.initialStoryIndex]);

  const [mediaSlideIndex, setMediaSlideIndex] = useState(defaultCarouselIndex);
  const didInitMediaIndexRef = useRef(false);
  const flatSlidesRef = useRef(flatMediaSlides);
  flatSlidesRef.current = flatMediaSlides;

  const [carouselUserInteracting, setCarouselUserInteracting] = useState(false);

  useLayoutEffect(() => {
    if (flatMediaSlides.length === 0 || didInitMediaIndexRef.current) return;
    const start = defaultCarouselIndex;
    setMediaSlideIndex(start);
    const row = flatMediaSlides[start];
    if (row) setCurrent(row.groupIndex, row.storyIndex);
    didInitMediaIndexRef.current = true;
  }, [defaultCarouselIndex, flatMediaSlides, setCurrent]);

  useEffect(() => {
    if (flatMediaSlides.length === 0) return;
    setMediaSlideIndex((i) => Math.min(i, flatMediaSlides.length - 1));
  }, [flatMediaSlides.length]);

  const safeSlideIndex = useMemo(
    () => (flatMediaSlides.length ? Math.min(mediaSlideIndex, flatMediaSlides.length - 1) : 0),
    [flatMediaSlides.length, mediaSlideIndex],
  );

  const activeSlide = flatMediaSlides[safeSlideIndex] ?? null;
  const activeStory = activeSlide?.story ?? null;
  const activeGroup =
    activeSlide != null && params.groups[activeSlide.groupIndex] != null
      ? params.groups[activeSlide.groupIndex]
      : null;

  const activeImageUrl = activeSlide?.rawUri ?? null;

  const activeOptimizedImageUrl = useMemo(
    () => (activeImageUrl ? getOptimizedImageUrl(activeImageUrl, 1080, 1920, 78) : null),
    [activeImageUrl],
  );
  const authorName = useMemo(() => {
    const first = activeStory?.profile?.first_name?.trim() ?? "";
    const last = activeStory?.profile?.last_name?.trim() ?? "";
    return `${first} ${last}`.trim() || "User";
  }, [activeStory?.profile?.first_name, activeStory?.profile?.last_name]);
  const authorAvatar = useMemo(() => {
    const raw = activeStory?.profile?.avatar_url?.trim();
    return raw && raw.length > 0 ? raw : null;
  }, [activeStory?.profile?.avatar_url]);
  const publishedAgo = useMemo(
    () =>
      activeStory?.created_at
        ? formatRelativeTime(activeStory.created_at, { style: "short", dateFallbackAfterDays: false })
        : "",
    [activeStory?.created_at],
  );
  const modalCardWidth = useMemo(() => Math.min(width - 24, 390), [width]);
  const modalCardHeight = useMemo(() => Math.min(Math.floor(height * 0.68), 560), [height]);
  const replyMutation = useReplyToStory();
  const reactMutation = useReactToStory();
  const [localReaction, setLocalReaction] = useState<StoryReactionType | null>(activeStory?.my_reaction ?? null);

  useEffect(() => {
    if (!activeStory) return;
    setLocalReaction(activeStory.my_reaction);
  }, [activeStory?.id, activeStory?.my_reaction]);

  const likeActive = localReaction === "like";

  const advanceAfterProgressTick = useCallback(() => {
    if (!flatSlidesRef.current.length) return;
    carouselRef.current?.next({ animated: true });
  }, []);

  const progressItemKey = flatMediaSlides[safeSlideIndex]?.key ?? "none";

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused: paused || inputFocused || keyboardOpen || previewOpen || carouselUserInteracting,
    itemKey: progressItemKey,
    onComplete: advanceAfterProgressTick,
  });

  const handleCarouselSnapToItem = useCallback(
    (index: number) => {
      const slides = flatSlidesRef.current;
      if (!slides.length) return;
      const len = slides.length;
      const normalized = ((index % len) + len) % len;
      setMediaSlideIndex(normalized);
      const row = slides[normalized];
      if (row) setCurrent(row.groupIndex, row.storyIndex);
    },
    [setCurrent],
  );

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const candidateIndexes = [
      mediaSlideIndex - 2,
      mediaSlideIndex - 1,
      mediaSlideIndex,
      mediaSlideIndex + 1,
      mediaSlideIndex + 2,
    ].filter((idx) => idx >= 0 && idx < flatMediaSlides.length);
    const candidateUrls = candidateIndexes
      .map((idx) => flatMediaSlides[idx]?.rawUri)
      .filter((url): url is string => Boolean(url));
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(
        candidateUrls.map((url) => getOptimizedImageUrl(url, 1080, 1920, 78) || url),
      );
    });
    return () => task.cancel();
  }, [flatMediaSlides, mediaSlideIndex]);


  const onSubmitReply = useCallback(async () => {
    if (!activeStory) return;
    const content = inputValue.trim();
    if (!content) return;
    await replyMutation.mutateAsync({ storyId: activeStory.id, content });
    setInputValue("");
    Keyboard.dismiss();
  }, [activeStory, inputValue, replyMutation]);

  const onToggleLike = useCallback(async () => {
    if (!activeStory) return;
    const previousReaction = localReaction;
    const nextReaction = previousReaction === "like" ? null : "like";
    setLocalReaction(nextReaction);
    try {
      await reactMutation.mutateAsync({ storyId: activeStory.id, type: "like" });
    } catch (error) {
      setLocalReaction(previousReaction);
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not react to story");
    }
  }, [activeStory, localReaction, navigation, reactMutation]);

  const onCopyStoryImage = useCallback(async () => {
    if (!activeImageUrl) return;
    await Clipboard.setStringAsync(activeImageUrl);
    setCopied(true);
    Toast.show({
      type: "success",
      text1: "Image link was copied to clipboard",
    });
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [activeImageUrl]);

  const handleSlideTap = useCallback(() => {
    Keyboard.dismiss();
    if (!activeStory) return;
    const now = Date.now();
    const prev = lastTapRef.current;
    if (prev && prev.storyId === activeStory.id && now - prev.ts <= DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      setPaused(true);
      setPreviewOpen(true);
      return;
    }
    lastTapRef.current = { ts: now, storyId: activeStory.id };
  }, [activeStory, setPaused]);

  const closeImagePreview = useCallback(() => {
    setPreviewOpen(false);
    setPaused(false);
  }, [setPaused]);

  useEffect(() => {
    if (!previewOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeImagePreview();
      return true;
    });
    return () => sub.remove();
  }, [previewOpen, closeImagePreview]);

  if (flatMediaSlides.length === 0 || !activeStory || !activeGroup) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No stories available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.storyChrome} collapsable={false}>
        <Carousel
          ref={carouselRef}
          width={width}
          height={height}
          data={flatMediaSlides}
          defaultIndex={defaultCarouselIndex}
          loop={flatMediaSlides.length > 1}
          autoFillData={false}
          scrollAnimationDuration={550}
          onScrollStart={() => setCarouselUserInteracting(true)}
          onScrollEnd={() => setCarouselUserInteracting(false)}
          onSnapToItem={handleCarouselSnapToItem}
          renderItem={({ item }) => {
            const rawUri = item.rawUri;
            const optimized = rawUri ? getOptimizedImageUrl(rawUri, 1080, 1920, 78) : null;
            return (
              <Pressable
                style={styles.absoluteFill}
                onPress={handleSlideTap}
                onLongPress={() => setPaused(true)}
                onPressOut={() => setPaused(false)}
                delayLongPress={180}
              >
                <StoryMediaSlide
                  optimizedUri={optimized || rawUri}
                  fallbackUri={rawUri}
                  recyclingKey={`feed-story-viewer-${item.key}`}
                  width={width}
                  height={height}
                />
              </Pressable>
            );
          }}
        />

        <View style={[styles.topProgressRow, { top: Math.max(4, insets.top + 4) }]}>
          <StoryProgressBar
            count={Math.max(1, flatMediaSlides.length)}
            currentIndex={safeSlideIndex}
            progress={progress}
          />
        </View>

        <View style={[styles.topRow, { top: Math.max(22, insets.top + 22) }]}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#111111" />
          </Pressable>
          <View style={styles.authorRow}>
            {authorAvatar ? (
              <SmartImage uri={authorAvatar} recyclingKey={authorAvatar} style={styles.authorAvatar} contentFit="cover" />
            ) : (
              <View style={styles.authorAvatarFallback}>
                <Text style={styles.authorAvatarFallbackText}>{authorName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.authorMetaCol}>
              <View style={styles.authorMetaTopRow}>
                <Text style={styles.authorNameText} numberOfLines={1}>
                  {authorName}
                </Text>
                <Text style={styles.authorTimeText}>{publishedAgo}</Text>
              </View>
              <Text style={styles.authorStoryPreviewText} numberOfLines={1} ellipsizeMode="tail">
                {activeStory.content?.trim() || " "}
              </Text>
            </View>
          </View>
          <View style={styles.rightSpacer} />
        </View>

        <Animated.View
          style={[
            styles.bottomComposer,
            {
              bottom: 0,
              backgroundColor: composerTheme.barBg,
              ...(Platform.OS !== "android"
                ? { paddingBottom: composerFooterPaddingBottom }
                : { paddingBottom: COMPOSER_FOOTER_PADDING_ANDROID }),
            },
            composerBarAnimatedStyle,
          ]}
        >
          <View style={styles.composerRow}>
            <View style={styles.inputWrap}>
              <RichTextarea
                ref={composerInputRef}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Send message…"
                placeholderTextColor={composerTheme.placeholder}
                onFocus={() => {
                  setInputFocused(true);
                  if (Platform.OS === "android") {
                    requestAnimationFrame(() => recalculateAndroidComposerLift());
                  }
                }}
                onBlur={() => setInputFocused(false)}
                onContentSizeChange={() => {
                  if (Platform.OS === "android" && inputFocused) {
                    recalculateAndroidComposerLift();
                  }
                }}
                textAlignVertical="center"
                style={[
                  styles.input,
                  { color: composerTheme.text, borderColor: composerTheme.border },
                ]}
              />
            </View>
            <View style={styles.actionsRight}>
              <Pressable style={styles.actionIcon} hitSlop={12} onPress={() => void onToggleLike()}>
                <AnimatedLikeHeart
                  liked={likeActive}
                  size={26}
                  color={composerTheme.icon}
                  likedColor="#F4212E"
                />
              </Pressable>
              <Pressable
                style={styles.actionIcon}
                hitSlop={12}
                onPress={() => navigation.navigate("StoryDiscussion", { storyId: activeStory.id, placeId: activeStory.place_id })}
              >
                <Ionicons name="chatbubble-outline" size={24} color={composerTheme.icon} />
              </Pressable>
              <Pressable style={styles.actionIcon} hitSlop={12} onPress={() => void onSubmitReply()}>
                <Ionicons
                  name="paper-plane-outline"
                  size={25}
                  color={inputValue.trim() ? composerTheme.icon : composerTheme.iconMuted}
                />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {previewOpen ? (
        <View style={styles.previewOverlayRoot} pointerEvents="box-none">
          <Pressable style={styles.absoluteFill} onPress={closeImagePreview}>
            {Platform.OS === "web" ? (
              <View style={[styles.absoluteFill, { backgroundColor: "rgba(0,0,0,0.58)" }]} />
            ) : (
              <>
                <BlurView
                  intensity={Platform.OS === "ios" ? 52 : 68}
                  tint="dark"
                  style={styles.absoluteFill}
                  {...(Platform.OS === "android"
                    ? { experimentalBlurMethod: "dimezisBlurView" as const, blurReductionFactor: 3.5 }
                    : {})}
                />
                <View style={[styles.absoluteFill, styles.previewDimOverlay]} pointerEvents="none" />
              </>
            )}
          </Pressable>
          <View
            style={[
              styles.modalCard,
              {
                width: modalCardWidth,
                height: modalCardHeight,
                top: Math.round((height - modalCardHeight) / 2),
                left: Math.round((width - modalCardWidth) / 2),
              },
            ]}
            pointerEvents="box-none"
          >
            <SmartImage
              uri={activeOptimizedImageUrl || activeImageUrl}
              fallbackUri={activeImageUrl}
              recyclingKey={activeSlide ? `preview-${activeSlide.key}` : `preview-${activeStory.id}`}
              style={styles.modalCardImage}
              contentFit="cover"
              pointerEvents="none"
              transition={100}
            />
            <View style={styles.modalCardHeader}>
              <View style={styles.modalAuthorWrap}>
                {authorAvatar ? (
                  <SmartImage uri={authorAvatar} recyclingKey={`${authorAvatar}-modal`} style={styles.authorAvatar} contentFit="cover" />
                ) : (
                  <View style={styles.authorAvatarFallback}>
                    <Text style={styles.authorAvatarFallbackText}>{authorName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.modalAuthorName} numberOfLines={1}>
                  {authorName}
                </Text>
              </View>
              <Pressable style={styles.copyIconButton} onPress={() => void onCopyStoryImage()}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color="#111111" />
              </Pressable>
            </View>
            <View style={styles.modalCardFooter}>
              <Text style={styles.modalFooterText} numberOfLines={3}>
                {activeStory.content?.trim() || " "}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topProgressRow: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 12,
  },
  topRow: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rightSpacer: {
    width: 42,
    height: 42,
  },
  authorRow: {
    flex: 1,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  authorAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  authorAvatarFallbackText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 13,
  },
  authorNameText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "72%",
  },
  authorMetaCol: {
    flex: 1,
    gap: 1,
  },
  authorMetaTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorTimeText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "500",
  },
  authorStoryPreviewText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "500",
  },
  bottomComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    ...(Platform.OS === "android" ? { elevation: 20 } : null),
    alignItems: "stretch",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "75%",
    minWidth: 0,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    minHeight: 44,
    marginLeft: 4,
    flexShrink: 0,
  },
  actionIcon: {
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  emptyText: {
    color: "#ffffff",
  },
  storyChrome: {
    flex: 1,
  },
  previewOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  previewDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  modalCard: {
    position: "absolute",
    zIndex: 110,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  modalCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCardHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: 56,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    zIndex: 24,
  },
  modalCardFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    paddingHorizontal: 12,
    zIndex: 24,
  },
  modalAuthorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "78%",
  },
  modalAuthorName: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "700",
  },
  copyIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  modalFooterText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "500",
  },
});

