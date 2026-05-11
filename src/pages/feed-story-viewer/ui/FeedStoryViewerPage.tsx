import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useStoryProgress, useStoryViewer, useReplyToStory, useReactToStory } from "@/entities/story";
import { StoryProgressBar } from "@/components/stories/StoryProgressBar";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";
import Toast from "react-native-toast-message";

type FeedStoryViewerRoute = RouteProp<BrowseFlowParamList, "FeedStoryViewer">;
type FeedStoryViewerNav = NativeStackNavigationProp<BrowseFlowParamList, "FeedStoryViewer">;

const AUTO_ADVANCE_MS = 5000;
const KEYBOARD_GAP = -5;
const DOUBLE_TAP_MS = 260;

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

export default function FeedStoryViewerPage() {
  const { params } = useRoute<FeedStoryViewerRoute>();
  const navigation = useNavigation<FeedStoryViewerNav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
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
  const keyboardInsetAnim = useRef(new Animated.Value(0)).current;
  const [inputValue, setInputValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastTapRef = useRef<{ ts: number; storyId: string } | null>(null);

  const viewer = useStoryViewer({
    groups: params.groups,
    initialGroupIndex: params.initialGroupIndex,
    initialStoryIndex: params.initialStoryIndex,
  });

  const activeStory = viewer.activeStory;
  const storyId = activeStory?.id ?? "";
  const activeImageUrl = parseStoryMediaUrl(activeStory?.media_url);
  const authorName = useMemo(() => {
    const first = activeStory?.profile?.first_name?.trim() ?? "";
    const last = activeStory?.profile?.last_name?.trim() ?? "";
    return `${first} ${last}`.trim() || "User";
  }, [activeStory?.profile?.first_name, activeStory?.profile?.last_name]);
  const authorAvatar = useMemo(() => {
    const raw = activeStory?.profile?.avatar_url?.trim();
    return raw && raw.length > 0 ? raw : null;
  }, [activeStory?.profile?.avatar_url]);
  const publishedAgo = useMemo(() => {
    if (!activeStory?.created_at) return "";
    const diffMs = Date.now() - new Date(activeStory.created_at).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return "";
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return `${Math.floor(diffHr / 24)}d`;
  }, [activeStory?.created_at]);
  const modalCardWidth = useMemo(() => Math.min(width - 24, 390), [width]);
  const modalCardHeight = useMemo(() => Math.min(Math.floor(height * 0.68), 560), [height]);
  const likeActive = activeStory?.my_reaction === "like";
  const replyMutation = useReplyToStory();
  const reactMutation = useReactToStory();

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused: viewer.paused || inputFocused || keyboardOpen,
    itemKey: storyId,
    onComplete: viewer.goToNextStory,
  });

  useEffect(() => {
    const row = viewer.findByFlatIndex(viewer.currentFlatIndex);
    if (!row) return;
    carouselRef.current?.scrollTo({ index: viewer.currentFlatIndex, animated: true });
  }, [viewer, viewer.currentFlatIndex]);

  useEffect(() => {
    const animateKeyboardInset = (toValue: number, duration?: number) => {
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration: duration ?? 250,
        useNativeDriver: true,
      }).start();
    };
    const onKeyboardFrameChange = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      const windowHeightValue = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeightValue - event.endCoordinates.height;
      const overlap = Math.max(0, windowHeightValue - keyboardTop);
      setKeyboardOpen(overlap > 0);
      animateKeyboardInset(Math.max(0, overlap + KEYBOARD_GAP), event.duration);
    };
    const onKeyboardHide = (event?: { duration?: number }) => {
      setKeyboardOpen(false);
      animateKeyboardInset(0, event?.duration);
    };
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, onKeyboardFrameChange);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardInsetAnim]);

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
    await reactMutation.mutateAsync({ storyId: activeStory.id, type: "like" });
  }, [activeStory, reactMutation]);

  const onCopyStoryImage = useCallback(async () => {
    if (!activeImageUrl) return;
    await Clipboard.setStringAsync(activeImageUrl);
    setCopied(true);
    Toast.show({
      type: "success",
      text1: "Image link was copied to clipboard",
    });
    setTimeout(() => setCopied(false), 1800);
  }, [activeImageUrl]);

  const handleSlideTap = useCallback(() => {
    Keyboard.dismiss();
    if (!activeStory) return;
    const now = Date.now();
    const prev = lastTapRef.current;
    if (prev && prev.storyId === activeStory.id && now - prev.ts <= DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      viewer.setPaused(true);
      setPreviewOpen(true);
      return;
    }
    lastTapRef.current = { ts: now, storyId: activeStory.id };
  }, [activeStory, viewer]);

  if (!activeStory || !viewer.activeGroup) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No stories available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Carousel
        ref={carouselRef}
        width={width}
        height={height}
        data={viewer.flatStories}
        loop={false}
        onSnapToItem={(index) => {
          const row = viewer.findByFlatIndex(index);
          if (!row) return;
          viewer.setCurrent(row.groupIndex, row.storyIndex);
        }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.absoluteFill}
            onPress={handleSlideTap}
            onLongPress={() => viewer.setPaused(true)}
            onPressOut={() => viewer.setPaused(false)}
            delayLongPress={180}
          >
            <SmartImage
              uri={parseStoryMediaUrl(item.story.media_url)}
              recyclingKey={`feed-story-viewer-${item.story.id}`}
              style={styles.absoluteFill}
              contentFit="cover"
            />
          </Pressable>
        )}
      />

      <View style={[styles.topProgressRow, { top: Math.max(4, insets.top + 4) }]}>
        <StoryProgressBar
          count={Math.max(1, viewer.activeGroup.stories.length)}
          currentIndex={viewer.currentStoryIndex}
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
            paddingBottom: 10 + Math.max(insets.bottom, 8),
            transform: [{ translateY: Animated.multiply(keyboardInsetAnim, -1) }],
          },
        ]}
      >
        <View style={styles.composerRow}>
          <View style={styles.inputWrap}>
            <RichTextarea
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Send message…"
              placeholderTextColor={composerTheme.placeholder}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              textAlignVertical="center"
              style={[
                styles.input,
                { color: composerTheme.text, borderColor: composerTheme.border },
              ]}
            />
          </View>
          <View style={styles.actionsRight}>
            <Pressable style={styles.actionIcon} hitSlop={12} onPress={() => void onToggleLike()}>
              <Ionicons
                name={likeActive ? "heart" : "heart-outline"}
                size={26}
                color={likeActive ? "#F4212E" : composerTheme.icon}
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

      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPreviewOpen(false);
          viewer.setPaused(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[styles.absoluteFill, { zIndex: 1 }]}
            onPress={() => {
              setPreviewOpen(false);
              viewer.setPaused(false);
            }}
          >
            {activeImageUrl ? <Image source={{ uri: activeImageUrl }} style={styles.modalBackdropImage} blurRadius={24} /> : null}
            <View style={styles.modalBackdropDim} />
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
          >
            <SmartImage
              uri={activeImageUrl}
              recyclingKey={`preview-${activeStory.id}`}
              style={styles.modalCardImage}
              contentFit="cover"
              pointerEvents="none"
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
      </Modal>
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
    zIndex: 9,
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
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  modalBackdropImage: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  modalCard: {
    position: "absolute",
    zIndex: 22,
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

