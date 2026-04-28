import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/hooks/useBusinessCards";
import { useReviews } from "@/hooks/useReviews";
import { useAuth } from "@/contexts/AuthContext";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";
import { DirectionsModal } from "@/components/DirectionsModal";
import type { BrowseFlowParamList } from "@/navigation/types";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage, normalizeBusinessCardImages } from "@/lib/businessCardImages";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import Carousel from "react-native-reanimated-carousel";
import { StoryBubblesRow } from "@/components/stories/StoryBubblesRow";
import { useStories } from "@/hooks/useStories";
import {
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/theme/primaryPressable";

type R = RouteProp<BrowseFlowParamList, "PlaceDetail">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceDetail">;

export default function PlaceDetailScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data: place, isLoading } = useBusinessCard(id);
  const { width: windowWidth } = useWindowDimensions();
  const { data: reviews = [] } = useReviews(id);
  const {
    groupedStories,
    isLoading: storiesLoading,
    isError: storiesError,
    refetch: refetchStories,
  } = useStories(id);
  const { user } = useAuth();
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [seenStoryIds, setSeenStoryIds] = useState<Record<string, true>>({});

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: "center", alignItems: "center" },
        heroBar: {
          position: "absolute",
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        },
        iconBtnText: { fontSize: 18, color: "#111" },
        heroDotsRow: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 10,
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
        },
        heroDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: "rgba(255,255,255,0.45)",
        },
        heroDotActive: {
          backgroundColor: "rgba(255,255,255,0.95)",
        },
        card: {
          marginTop: -24,
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: { fontSize: 22, fontWeight: "800", color: colors.text },
        rating: { marginTop: 6, color: colors.textMuted, fontSize: 14 },
        tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
        tag: {
          fontSize: 12,
          backgroundColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          color: colors.text,
        },
        desc: { marginTop: 16, color: colors.textMuted, lineHeight: 22 },
        addr: { marginTop: 12, color: colors.text },
        actions: { flexDirection: "row", gap: 10, marginTop: 16 },
        secondaryBtn: {
          flex: 1,
          minHeight: SHARED_PRESSABLE_HEIGHT,
          borderRadius: SHARED_PRESSABLE_RADIUS,
          backgroundColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        secondaryBtnText: { fontWeight: "600", color: colors.text },
        primaryBtn: {
          marginTop: 16,
          ...primaryPressableStyle,
        },
        primaryBtnText: primaryPressableTextStyle,
        outlineBtn: {
          marginTop: 10,
          minHeight: SHARED_PRESSABLE_HEIGHT,
          borderRadius: SHARED_PRESSABLE_RADIUS,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        outlineBtnText: { fontWeight: "700", color: colors.primary },
      }),
    [colors],
  );

  const openStoryGroup = useCallback(
    (groupIndex: number) => {
      const targetGroup = groupedStories[groupIndex];
      if (!targetGroup?.stories.length) return;

      setSeenStoryIds((prev) => {
        const next = { ...prev };
        for (const story of targetGroup.stories) {
          next[story.id] = true;
        }
        return next;
      });

      navigation.navigate("StoryViewer", {
        groups: groupedStories,
        initialGroupIndex: groupIndex,
        initialStoryIndex: 0,
        placeId: id,
      });
    },
    [groupedStories, id, navigation],
  );

  const openStoryComposer = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    navigation.navigate("StoryComposer", { placeId: id });
  }, [id, navigation, user]);

  if (isLoading || !place) {
    return (
      <View style={[stylesThemed.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const onFavorite = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const onCall = () => {
    if (!place.phone) {
      Alert.alert("Unavailable", "Phone number not available");
      return;
    }
    void Linking.openURL(`tel:${place.phone}`);
  };

  const heroTop = Math.max(insets.top, 12);
  const bottomScrollPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 24) : 20;
  const legacyImage = (place as unknown as { image?: string | null }).image;
  const heroImagesRaw = [
    ...normalizeBusinessCardImages(place.images),
    ...normalizeBusinessCardImages(legacyImage),
  ].filter((url, idx, arr) => arr.indexOf(url) === idx);
  const heroImages = heroImagesRaw.map((url) => getOptimizedImageUrl(url, 900, 560) || url);
  const heroFallback = getLatestBusinessCardImage(place.images) ?? getLatestBusinessCardImage(legacyImage);

  return (
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
    >
      <View>
        {heroImages.length > 1 ? (
          <>
            <Carousel
              width={windowWidth}
              height={280}
              data={heroImages}
              loop={false}
              onSnapToItem={setHeroSlide}
              renderItem={({ item, index }) => (
                <SmartImage
                  uri={item}
                  fallbackUri={heroImagesRaw[index] ?? null}
                  recyclingKey={`${place.id}-hero-${index}`}
                  style={styles.hero}
                  contentFit="cover"
                  transition={200}
                />
              )}
            />
            <View style={stylesThemed.heroDotsRow}>
              {heroImages.map((_, idx) => (
                <View key={`${place.id}-hero-dot-${idx}`} style={[stylesThemed.heroDot, heroSlide === idx && stylesThemed.heroDotActive]} />
              ))}
            </View>
          </>
        ) : (
          <SmartImage
            uri={heroImages[0] ?? heroFallback}
            fallbackUri={heroImagesRaw[0] ?? null}
            recyclingKey={place.id}
            style={styles.hero}
            contentFit="cover"
          />
        )}
        <View style={[stylesThemed.heroBar, { top: heroTop }]}>
          <Pressable style={stylesThemed.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={stylesThemed.iconBtnText}>←</Text>
          </Pressable>
          <Pressable style={stylesThemed.iconBtn} onPress={onFavorite}>
            <Text style={stylesThemed.iconBtnText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={stylesThemed.card}>
        <StoryBubblesRow
          groups={groupedStories}
          seenStoryIds={seenStoryIds}
          onPressGroup={openStoryGroup}
          onPressAddStory={openStoryComposer}
          loading={storiesLoading}
          isError={storiesError}
          onRetry={() => void refetchStories()}
        />
        <Text style={stylesThemed.title}>{place.name}</Text>
        <Text style={stylesThemed.rating}>
          {Number(place.rating).toFixed(1)} ({reviews.length} reviews) · {Number(place.booking_price).toLocaleString()}{" "}
          $
        </Text>
        <View style={stylesThemed.tags}>
          {place.tags.map((tag) => (
            <Text key={tag} style={stylesThemed.tag}>
              {tag}
            </Text>
          ))}
        </View>
        <Text style={stylesThemed.desc}>{place.description}</Text>
        <Text style={stylesThemed.addr}>📍 {place.address}</Text>

        <View style={stylesThemed.actions}>
          <Pressable style={stylesThemed.secondaryBtn} onPress={onCall}>
            <Text style={stylesThemed.secondaryBtnText}>Call</Text>
          </Pressable>
          <Pressable style={stylesThemed.secondaryBtn} onPress={() => setDirectionsOpen(true)}>
            <Text style={stylesThemed.secondaryBtnText}>Directions</Text>
          </Pressable>
        </View>

        <Pressable style={stylesThemed.primaryBtn} onPress={() => navigation.navigate("BookingFlow", { id: place.id })}>
          <Text style={stylesThemed.primaryBtnText}>Book now</Text>
        </Pressable>
        <Pressable style={stylesThemed.outlineBtn} onPress={() => navigation.navigate("AIBooking", { id: place.id })}>
          <Text style={stylesThemed.outlineBtnText}>Book with PixAI</Text>
        </Pressable>
        {/* <Pressable style={stylesThemed.outlineBtn} onPress={() => navigation.navigate("ShoppingItems", { id: place.id })}>
          <Text style={stylesThemed.outlineBtnText}>Order items</Text>
        </Pressable> */}
      </View>

      <DirectionsModal
        visible={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        placeName={place.name}
        address={place.address}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280 },
});
