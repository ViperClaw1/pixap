import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { animateStoryViewerDismissWorklet } from "@/shared/lib/storyViewerDismissAnimation";
import { Ionicons } from "@expo/vector-icons";
import Carousel, { type ICarouselInstance } from "react-native-reanimated-carousel";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { StoryProgressBar } from "@/shared/ui/story-progress-bar";
import { useStoryProgress } from "@/entities/story";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { useAddStoryFromPost } from "../model/useAddStoryFromPost";

const AUTO_ADVANCE_MS = 5000;
const KEYBOARD_GAP = 16;
const ANDROID_KEYBOARD_GAP = -70;
/** Min downward drag (px) before dismiss — matches story viewer. */
const DISMISS_DRAG_PX = 100;

type AddStoryRoute = RouteProp<BrowseFlowParamList, "AddStoryFromPost">;
type AddStoryNav = NativeStackNavigationProp<BrowseFlowParamList, "AddStoryFromPost">;

export default function AddStoryFromPostPage() {
  const { colors } = useAppTheme();
  const { width, height } = useStaticWindowSize();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AddStoryNav>();
  const isScreenFocused = useIsFocused();
  const { params } = useRoute<AddStoryRoute>();
  const carouselRef = useRef<ICarouselInstance | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardInsetAnim = useKeyboardInset({
    bottomInset: insets.bottom,
    gap: Platform.OS === "android" ? ANDROID_KEYBOARD_GAP : KEYBOARD_GAP,
    useNativeDriver: true,
    onKeyboardChange: (_keyboardTop, keyboardHeight) => {
      setKeyboardOpen(keyboardHeight > 0);
    },
  });
  const bottomAreaKeyboardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardInsetAnim.value }],
  }));
  const [captionFocused, setCaptionFocused] = useState(false);
  const [dismissDragging, setDismissDragging] = useState(false);
  const dismissTranslateY = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const safeImages = useMemo(() => params.postImages.filter((item) => item.trim().length > 0), [params.postImages]);
  const {
    caption,
    setCaption,
    followers,
    followersLoading,
    friendsModalVisible,
    openFriendsModal,
    closeFriendsModal,
    search,
    setSearch,
    selectedFriendIds,
    toggleFriend,
    shareToYourStory,
    shareWithFriends,
    isSubmitting,
  } = useAddStoryFromPost({
    placeId: params.placeId,
    postImages: safeImages,
  });

  const onAdvance = () => {
    if (!safeImages.length) return;
    const next = index >= safeImages.length - 1 ? 0 : index + 1;
    carouselRef.current?.scrollTo({ index: next, animated: true });
    setIndex(next);
  };

  const { progress } = useStoryProgress({
    durationMs: AUTO_ADVANCE_MS,
    paused:
      isSubmitting ||
      friendsModalVisible ||
      safeImages.length <= 1 ||
      keyboardOpen ||
      captionFocused ||
      dismissDragging,
    itemKey: `${params.postId}-${index}`,
    onComplete: onAdvance,
  });

  const closeScreen = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const dismissDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissTranslateY.value }],
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!friendsModalVisible && !keyboardOpen && !captionFocused && !isSubmitting)
        .activeOffsetY(6)
        .failOffsetX([-48, 48])
        .onBegin(() => {
          runOnJS(setDismissDragging)(true);
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
                closeScreen,
              );
              return;
            }
            dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
            runOnJS(setDismissDragging)(false);
            return;
          }
          dismissTranslateY.value = withSpring(0, { damping: 18, stiffness: 200 });
          runOnJS(setDismissDragging)(false);
        }),
    [
      captionFocused,
      closeScreen,
      dismissTranslateY,
      friendsModalVisible,
      height,
      isSubmitting,
      keyboardOpen,
    ],
  );

  const dismissCaptureGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, Gesture.Native()),
    [panGesture],
  );

  const onSubmitYourStory = async () => {
    const ok = await shareToYourStory();
    if (ok) navigation.goBack();
  };

  const onSubmitShareFriends = async () => {
    const ok = await shareWithFriends();
    if (ok) navigation.goBack();
  };

  const renderStoryImage = useCallback(
    ({ item }: { item: string }) => (
      <AppPressable style={styles.absoluteFill} onPress={() => Keyboard.dismiss()}>
        <SmartImage
          uri={item}
          recyclingKey={`add-story-${item}`}
          style={styles.absoluteFill}
          contentFit="cover"
          showLoadingSpinner
          loadingSpinnerColor="#ffffff"
        />
      </AppPressable>
    ),
    [],
  );

  return (
    <Animated.View style={[styles.root, dismissDragStyle]}>
      <SafeAreaView style={styles.flex} edges={[]}>
        <GestureDetector gesture={dismissCaptureGesture}>
          <View style={styles.dismissSurface}>
            <View style={styles.absoluteFill}>
              {safeImages.length ? (
                <Carousel
                  ref={carouselRef}
                  data={safeImages}
                  width={width}
                  height={height}
                  loop={safeImages.length > 1}
                  autoPlay={isScreenFocused && safeImages.length > 1}
                  autoPlayInterval={AUTO_ADVANCE_MS}
                  scrollAnimationDuration={550}
                  onSnapToItem={setIndex}
                  renderItem={renderStoryImage}
                />
              ) : (
                <View style={[styles.absoluteFill, styles.mediaLoading, { backgroundColor: colors.card }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            </View>
            <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + 8 }]}>
              <StoryProgressBar count={Math.max(1, safeImages.length)} currentIndex={index} progress={progress} />
              <View style={styles.topRow}>
                <AppPressable style={styles.closeBtn} onPress={closeScreen}>
                  <Ionicons name="close" size={22} color="#ffffff" />
                </AppPressable>
              </View>
            </View>

            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.bottomArea,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  backgroundColor: colors.background,
                  borderTopColor: colors.border,
                },
                bottomAreaKeyboardStyle,
              ]}
            >
              <View style={[styles.captionWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.captionInput, { color: colors.text }]}
                  onFocus={() => setCaptionFocused(true)}
                  onBlur={() => setCaptionFocused(false)}
                />
              </View>
              <View style={styles.actionsRow}>
                <AppPressable
                  style={[styles.storyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  disabled={isSubmitting}
                  onPress={() => void onSubmitYourStory()}
                >
                  <Text style={[styles.storyBtnText, { color: colors.text }]}>Your story</Text>
                </AppPressable>
                <AppPressable
                  style={[styles.friendsBtn, { backgroundColor: colors.primary }]}
                  disabled={isSubmitting}
                  onPress={openFriendsModal}
                >
                  <Text style={[styles.friendsBtnText, { color: colors.onPrimary }]}>Share with friends</Text>
                </AppPressable>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>

      <BottomSheetPickerModal visible={friendsModalVisible} onClose={closeFriendsModal} title="Share with friends" maxHeightFraction={0.78}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalSearchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search followers"
              placeholderTextColor={colors.textMuted}
              style={[styles.modalSearchInput, { color: colors.text }]}
            />
          </View>
          <View style={styles.modalGrid}>
            {followers.map((follower) => {
              const selected = selectedFriendIds.includes(follower.id);
              return (
                <AppPressable key={follower.id} style={styles.modalUserCard} onPress={() => toggleFriend(follower.id)}>
                  <View style={[styles.modalAvatarWrap, { borderColor: selected ? colors.primary : colors.border }]}>
                    <UserAvatarImage uri={follower.avatar_url} style={styles.modalAvatar} contentFit="cover" />
                    {selected ? (
                      <View style={[styles.modalSelectedBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.modalName, { color: colors.text }]} numberOfLines={2}>
                    {follower.fullName}
                  </Text>
                </AppPressable>
              );
            })}
          </View>
          {followersLoading ? (
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>Loading followers...</Text>
          ) : (
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>Selected: {selectedFriendIds.length}</Text>
          )}
          <AppPressable
            style={[
              styles.modalShareBtn,
              { backgroundColor: colors.primary, opacity: selectedFriendIds.length && !isSubmitting ? 1 : 0.5 },
            ]}
            disabled={!selectedFriendIds.length || isSubmitting}
            onPress={() => void onSubmitShareFriends()}
          >
            <Text style={[styles.modalShareText, { color: colors.onPrimary }]}>Share</Text>
          </AppPressable>
        </View>
      </BottomSheetPickerModal>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  flex: {
    flex: 1,
  },
  dismissSurface: {
    flex: 1,
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaLoading: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captionWrap: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  captionInput: {
    fontSize: 15,
    minHeight: 40,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storyBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  storyBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  friendsBtn: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  friendsBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalRoot: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  modalSearchWrap: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 38,
  },
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
  },
  modalUserCard: {
    width: "33.33%",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  modalAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  modalSelectedBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  modalName: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 17,
  },
  modalHint: {
    fontSize: 13,
    textAlign: "center",
  },
  modalShareBtn: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalShareText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
