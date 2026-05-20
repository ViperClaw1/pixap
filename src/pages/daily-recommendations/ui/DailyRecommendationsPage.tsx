import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Carousel from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { HomeStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BusinessCard } from "@/entities/business-card";
import { useFavorites } from "@/entities/favorite";
import { useDailyRecommendations, useTrackRecommendationEvent } from "@/entities/daily-recommendation";
import { useDailyRecommendationActions } from "@/features/daily-recommendations";
import BusinessPlaceCard from "@/widgets/place-card";
import { PageI18nProvider } from "@/shared/lib/i18n";

type Nav = NativeStackNavigationProp<HomeStackParamList, "DailyRecommendations">;
type Route = RouteProp<HomeStackParamList, "DailyRecommendations">;

function DailyRecommendationsPageContent() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const targetDate = route.params?.date;
  const [index, setIndex] = useState(0);

  const { data: recommendations = [], isLoading } = useDailyRecommendations(targetDate);
  const trackRecommendationEvent = useTrackRecommendationEvent();
  const { data: favorites = [] } = useFavorites();
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.business_card_id)), [favorites]);

  const actions = useDailyRecommendationActions({
    onOpenBooking: (venueId) => navigation.navigate("BookingFlow", { id: venueId }),
  });

  useEffect(() => {
    if (isLoading) return;
    if (recommendations.length === 0) {
      trackRecommendationEvent.mutate({
        event_name: "daily_recommendations_empty",
        payload: { date: targetDate ?? null },
      });
      return;
    }
    trackRecommendationEvent.mutate({
      event_name: "daily_recommendations_opened",
      payload: { source: "daily_screen", date: targetDate ?? null, count: recommendations.length },
    });
  }, [isLoading, recommendations.length, targetDate, trackRecommendationEvent]);

  useEffect(() => {
    if (recommendations.length === 0) return;
    actions.trackImpression(recommendations[index] ?? recommendations[0]);
  }, [actions, index, recommendations]);

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const active = recommendations[index];
  const isFavorite = active ? favoriteIds.has(active.venue_id) : false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("dailyRecommendations.title", { defaultValue: "Tonight for You" })}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t("dailyRecommendations.subtitle", { defaultValue: "Fresh picks generated for your taste." })}
        </Text>
      </View>

      {recommendations.length > 0 ? (
        <View style={styles.carouselWrap}>
          <Carousel
            width={340}
            height={430}
            data={recommendations}
            loop={false}
            onSnapToItem={(nextIndex) => {
              setIndex(nextIndex);
              const item = recommendations[nextIndex];
              if (item) actions.trackOpen(item);
            }}
            renderItem={({ item }) => (
              <View style={styles.cardWrap}>
                <BusinessPlaceCard
                  place={
                    {
                      id: item.venue_id,
                      name: item.name,
                      images: item.images,
                      category_id: null,
                      city: item.city,
                      address: "",
                      rating: item.rating,
                      tags: item.tags,
                      description: item.description,
                      booking_price: 0,
                      phone: "",
                      contact_whatsapp: null,
                      type: "recommended",
                      created_at: "",
                    } as BusinessCard
                  }
                  variant="vertical"
                />
                <View style={styles.reasons}>
                  {(item.recommendation_reasons ?? []).slice(0, 3).map((reason) => (
                    <Text key={`${item.venue_id}-${reason}`} style={[styles.reasonText, { color: colors.textMuted }]}>
                      • {reason}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t("dailyRecommendations.empty", { defaultValue: "No picks for today yet. Check back soon." })}
          </Text>
        </View>
      )}

      {active ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => actions.onSave(active, isFavorite)}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>
                {isFavorite ? t("dailyRecommendations.unsave", { defaultValue: "Unsave" }) : t("dailyRecommendations.save", { defaultValue: "Save" })}
              </Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => void actions.onShare(active)}>
              <Text style={[styles.actionText, { color: colors.text }]}>
                {t("dailyRecommendations.share", { defaultValue: "Share" })}
              </Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => actions.onDismiss(active)}>
              <Text style={[styles.actionText, { color: colors.text }]}>
                {t("dailyRecommendations.dislike", { defaultValue: "Dislike" })}
              </Text>
            </Pressable>
          </View>

          <Pressable style={[styles.bookBtn, { backgroundColor: colors.primary }]} onPress={() => actions.onBook(active)}>
            <Text style={[styles.bookBtnText, { color: colors.onPrimary ?? "#fff" }]}>
              {t("dailyRecommendations.book", { defaultValue: "Book now" })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function DailyRecommendationsPage() {
  return (
    <PageI18nProvider>
      <DailyRecommendationsPageContent />
    </PageI18nProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  carouselWrap: { flex: 1, justifyContent: "center" },
  cardWrap: { width: 340 },
  reasons: { marginTop: 10, gap: 4, minHeight: 66 },
  reasonText: { fontSize: 13, lineHeight: 18 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22 },
  footer: { gap: 12 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 13, fontWeight: "600" },
  bookBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnText: { fontSize: 16, fontWeight: "700" },
});
