import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Toast from "react-native-toast-message";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useBookings,
  deriveBookingDisplayStatus,
  type BookingDisplayStatus,
} from "@/entities/booking";
import { useBusinessCards } from "@/entities/business-card";
import type { BookingsStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { bookingsStaticStyles, bookingsThemeStyles } from "./bookingsStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import { useCartItems } from "@/entities/cart";
import { BOOKING_THUMB_SIZE, BookingListCard, bookingThumbUris, type BookingListItem } from "./BookingListCard";
import { BookingListSkeleton } from "./BookingListSkeleton";
import { ShimmerProvider } from "@/shared/ui/shimmer";
import { bookingStatusNotificationText, useCreateNotification } from "@/entities/notification";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";

type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingsMain">;

const filters: readonly BookingDisplayStatus[] = ["draft", "confirmed", "cancelled", "completed", "payment awaiting"];

function bookingFilterTranslationKey(status: BookingDisplayStatus): string {
  return status === "payment awaiting" ? "bookings.filter.paymentAwaiting" : `bookings.filter.${status}`;
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, mode, setMode } = useAppTheme();
  const { user, loading } = useAuth();
  useAuthSessionRedirect({
    authLoading: loading,
    hasUser: Boolean(user),
    navigation,
  });
  const [filter, setFilter] = useState<BookingDisplayStatus>("draft");
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const { data: bookings = [], isPending: bookingsPending } = useBookings();
  const { data: businessCards = [] } = useBusinessCards();
  const { data: cartItems = [], isPending: cartPending } = useCartItems();
  const isListLoading = Boolean(user) && (bookingsPending || cartPending);
  const showSkeleton = loading || isListLoading;
  const createNotification = useCreateNotification();
  const isCompact = windowWidth < 400;
  const prevStatusesRef = useRef<Map<string, BookingDisplayStatus>>(new Map());
  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const items = useMemo(() => {
    const cartMap = new Map(cartItems.map((item) => [`${item.business_card_id}|${item.date_time}`, item]));
    return bookings
      .map((booking) => {
        const linkedCartItem = cartMap.get(`${booking.business_card_id}|${booking.date_time}`);
        return {
          ...booking,
          waPaymentLink: linkedCartItem?.wa_payment_link?.trim() || null,
          waQrPayload: linkedCartItem?.wa_qr_payload ?? null,
          displayStatus: deriveBookingDisplayStatus(booking, linkedCartItem),
        };
      })
      .filter((item) => item.displayStatus === filter)
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  }, [bookings, cartItems, filter]);

  const bookingStatuses = useMemo(() => {
    const cartMap = new Map(cartItems.map((item) => [`${item.business_card_id}|${item.date_time}`, item]));
    return bookings.map((booking) => {
      const linkedCartItem = cartMap.get(`${booking.business_card_id}|${booking.date_time}`);
      return {
        id: booking.id,
        venueName: booking.business_card?.name ?? t("bookings.defaultVenueName"),
        businessCardId: booking.business_card_id,
        status: deriveBookingDisplayStatus(booking, linkedCartItem),
      };
    });
  }, [bookings, cartItems, t]);

  const themed = useThemeStyles(({ colors: c }) => bookingsThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(bookingsStaticStyles, themed),
    [themed],
  );

  useEffect(() => {
    const prev = prevStatusesRef.current;
    for (const current of bookingStatuses) {
      const previousStatus = prev.get(current.id);
      if (!previousStatus) continue;
      if (previousStatus !== current.status) {
        const text = bookingStatusNotificationText(current.venueName, current.status);
        Toast.show({
          type: "success",
          text1: t("bookings.toastStatusUpdated"),
          text2: text,
        });
        createNotification.mutate({
          text,
          businessCardId: current.businessCardId,
        });
      }
    }
    prevStatusesRef.current = new Map(bookingStatuses.map((x) => [x.id, x.status]));
  }, [bookingStatuses, createNotification, t]);

  const listContentPaddingBottom = 100 + insets.bottom;

  const renderItem = useCallback(
    ({ item }: { item: BookingListItem }) => (
      <BookingListCard item={item} styles={styles} isCompact={isCompact} />
    ),
    [isCompact, styles],
  );

  if (!user && !loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        title={t("header.bookings")}
        leftIcon="add"
        onLeftPress={() => setPlacePickerOpen(true)}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        notificationsEnabled
      />
      <View style={styles.filters}>
        {filters.map((f) => (
          <Pressable
            key={f}
            style={[styles.fpill, filter === f && styles.fpillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? styles.fpillTextA : styles.fpillText}>{t(bookingFilterTranslationKey(f))}</Text>
          </Pressable>
        ))}
      </View>
      {showSkeleton ? (
        <ShimmerProvider active>
          <BookingListSkeleton
            styles={styles}
            isCompact={isCompact}
            contentPaddingBottom={listContentPaddingBottom}
          />
        </ShimmerProvider>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(b) => b.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.bookingCard}
          contentContainerStyle={{ padding: 16, paddingBottom: listContentPaddingBottom }}
          ListEmptyComponent={<Text style={styles.empty}>{t("bookings.noBookings")}</Text>}
          renderItem={renderItem}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          updateCellsBatchingPeriod={40}
        />
      )}
      <BottomSheetPickerModal visible={placePickerOpen} onClose={() => setPlacePickerOpen(false)} title={t("bookings.choosePlace")}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
          {businessCards.length ? (
            businessCards.map((item) => {
              const thumbEdge = isCompact ? 56 : BOOKING_THUMB_SIZE;
              const { uri: thumbUri, fallbackUri: thumbFallback } = bookingThumbUris(item.images, thumbEdge);
              return (
              <View key={item.id} style={styles.card}>
                <SmartImage
                  uri={thumbUri}
                  fallbackUri={thumbFallback}
                  bundledFallback={PLACE_IMAGE_FALLBACK}
                  recyclingKey={`book-place-${item.id}`}
                  style={[styles.thumb, isCompact ? styles.thumbCompact : null]}
                  contentFit="cover"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={2}>
                    {item.tags?.slice(0, 4).join(", ") || t("bookings.noTags")}
                  </Text>
                </View>
                <Pressable
                  style={styles.payBtn}
                  onPress={() => {
                    setPlacePickerOpen(false);
                    navigation.navigate("BookingFlow", { id: item.id });
                  }}
                >
                  <Text style={styles.payBtnText}>{t("bookings.book")}</Text>
                </Pressable>
              </View>
            );
            })
          ) : (
            <Text style={styles.empty}>{t("bookings.noPlacesYet")}</Text>
          )}
        </ScrollView>
      </BottomSheetPickerModal>
    </View>
  );
}
