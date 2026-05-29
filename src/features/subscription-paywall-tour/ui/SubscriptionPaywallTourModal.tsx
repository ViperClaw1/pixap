import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getPaywallTourSlides, resolvePaywallTourLocale, type PaywallTourSlide } from "../model/paywallTourSlides";
import { subscriptionPaywallTourStyles as styles } from "./subscriptionPaywallTourStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SubscriptionPaywallTourModal({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useStaticWindowSize();
  const listRef = useRef<FlatList<PaywallTourSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const tourLocale = resolvePaywallTourLocale(i18n.language);
  const slides = useMemo(() => getPaywallTourSlides(i18n.language), [i18n.language]);

  const slideCount = slides.length;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: 0, animated: false });
    });
  }, [visible, tourLocale]);

  const isFirstSlide = activeIndex === 0;
  const isLastSlide = activeIndex === slideCount - 1;
  const activeSlide = slides[activeIndex];

  const scrollToIndex = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, slideCount - 1));
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    },
    [slideCount],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      setActiveIndex(Math.max(0, Math.min(nextIndex, slideCount - 1)));
    },
    [slideCount, width],
  );

  const renderItem = useCallback<ListRenderItem<PaywallTourSlide>>(
    ({ item }) => (
      <View style={[styles.slide, { width }]}>
        <Image source={item.image} style={styles.screenshot} contentFit="contain" transition={120} />
      </View>
    ),
    [width],
  );

  if (!visible || !activeSlide) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("subscriptionPaywall.tour.close")}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        <FlatList
          key={tourLocale}
          ref={listRef}
          data={slides}
          keyExtractor={(item) => `${tourLocale}-${item.id}`}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          style={styles.carousel}
          getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
        />

        <View style={styles.footer}>
          <Text style={styles.title}>{t(activeSlide.titleKey)}</Text>
          <Text style={styles.description}>{t(activeSlide.descriptionKey)}</Text>

          <View style={styles.dots}>
            {slides.map((slide, index) => (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  { backgroundColor: index === activeIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)" },
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isFirstSlide}
              onPress={() => scrollToIndex(activeIndex - 1)}
              style={[styles.actionButton, styles.backButton, isFirstSlide && styles.backButtonDisabled]}
            >
              <Text style={styles.actionText}>{t("subscriptionPaywall.tour.back")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => (isLastSlide ? onClose() : scrollToIndex(activeIndex + 1))}
              style={[styles.actionButton, styles.nextButton]}
            >
              <Text style={styles.actionText}>
                {isLastSlide ? t("subscriptionPaywall.tour.done") : t("subscriptionPaywall.tour.next")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
