import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
  PixelRatio,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Toast from "react-native-toast-message";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useBookings,
  useCancelBooking,
  deriveBookingDisplayStatus,
  type Booking,
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
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import { useCartItems } from "@/entities/cart";
import { bookingStatusNotificationText, useCreateNotification } from "@/entities/notification";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";

type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingsMain">;

const filters: readonly BookingDisplayStatus[] = ["draft", "confirmed", "cancelled", "completed", "payment awaiting"];

function bookingFilterTranslationKey(status: BookingDisplayStatus): string {
  return status === "payment awaiting" ? "bookings.filter.paymentAwaiting" : `bookings.filter.${status}`;
}

const BOOKING_THUMB_SIZE = 64;

function bookingThumbUris(images: unknown, edgePx = BOOKING_THUMB_SIZE): { uri: string | null; fallbackUri: string | null } {
  const fallbackUri = getLatestBusinessCardImage(images);
  if (!fallbackUri) return { uri: null, fallbackUri: null };
  const dpr = Math.min(2, PixelRatio.get());
  const edge = Math.round(edgePx * dpr);
  const uri = getOptimizedImageUrl(fallbackUri, edge, edge, 72) || fallbackUri;
  return { uri, fallbackUri };
}

function formatBookingDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}, ${hh}:${minutes}`;
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
    navigation: navigation as unknown as NavigationProp<ParamListBase>,
  });
  const [filter, setFilter] = useState<BookingDisplayStatus>("draft");
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const { data: bookings = [] } = useBookings();
  const { data: businessCards = [] } = useBusinessCards();
  const { data: cartItems = [] } = useCartItems();
  const cancelBooking = useCancelBooking();
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

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textMuted }}>{t("bookings.loading")}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const statusPalette = (status: BookingDisplayStatus) => {
    switch (status) {
      case "draft":
        return { bg: "#F3F4F6", fg: "#374151" };
      case "confirmed":
        return { bg: "#DCFCE7", fg: "#166534" };
      case "cancelled":
        return { bg: "#FEE2E2", fg: "#991B1B" };
      case "completed":
        return { bg: "#DBEAFE", fg: "#1E3A8A" };
      case "payment awaiting":
      default:
        return { bg: "#FEF3C7", fg: "#92400E" };
    }
  };

  const openPaymentLink = async (paymentLink: string | null) => {
    if (!paymentLink) {
      Alert.alert(t("bookings.paymentLinkMissingTitle"), t("bookings.paymentLinkMissingBody"));
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(paymentLink);
      if (!canOpen) {
        Alert.alert(t("bookings.cannotOpenPaymentLink"), paymentLink);
        return;
      }
      await Linking.openURL(paymentLink);
    } catch (error) {
      Alert.alert(t("bookings.cannotOpenPaymentLink"), error instanceof Error ? error.message : t("common.unknownError"));
    }
  };

  const renderItem = ({ item }: { item: Booking & { displayStatus: BookingDisplayStatus; waPaymentLink: string | null } }) => {
    const palette = statusPalette(item.displayStatus);
    const canCancel = item.displayStatus !== "cancelled" && item.displayStatus !== "completed";
    const canPay =
      (item.displayStatus === "confirmed" || item.displayStatus === "payment awaiting") &&
      item.payment_status === "pending" &&
      Boolean(item.waPaymentLink);
    const thumbEdge = isCompact ? 56 : BOOKING_THUMB_SIZE;
    const { uri: thumbUri, fallbackUri: thumbFallback } = bookingThumbUris(item.business_card?.images, thumbEdge);
    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("PlaceDetail", { id: item.business_card_id })}
      >
        <SmartImage
          uri={thumbUri}
          fallbackUri={thumbFallback}
          recyclingKey={`${item.id}-thumb`}
          style={[styles.thumb, isCompact ? styles.thumbCompact : null]}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <View style={styles.rowHead}>
            <View style={styles.rowHeadLeft}>
              <Text style={styles.name} numberOfLines={isCompact ? 2 : 1}>
                {item.business_card?.name}
              </Text>
            </View>
            {canCancel ? (
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  Alert.alert(t("bookings.cancelBookingTitle"), t("bookings.cancelBookingMessage"), [
                    { text: t("bookings.no"), style: "cancel" },
                    {
                      text: t("bookings.yesCancel"),
                      style: "destructive",
                      onPress: () => {
                        void cancelBooking.mutateAsync(item.id);
                      },
                    },
                  ]);
                }}
              >
                <Text style={styles.cancelBtnText}>{t("bookings.cancel")}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.meta}>{formatBookingDateTime(item.date_time)}</Text>
          {item.persons ? <Text style={styles.meta}>{t("bookings.persons", { count: item.persons })}</Text> : null}
          {item.comment ? <Text style={styles.meta}>{t("bookings.comment", { text: item.comment })}</Text> : null}
          {item.displayStatus !== "draft" ? (
            <Text style={styles.meta}>
              {t("bookings.payment", {
                state: item.payment_status === "pending" ? t("bookings.paymentPending") : t("bookings.paymentPaid"),
              })}
            </Text>
          ) : null}
          {canPay ? (
            <Pressable
              style={styles.payBtn}
              onPress={(event) => {
                event.stopPropagation?.();
                void openPaymentLink(item.waPaymentLink);
              }}
            >
              <Text style={styles.payBtnText}>{t("bookings.pay")}</Text>
            </Pressable>
          ) : null}
          {item.displayStatus === "draft" ? (
            <View style={styles.waitingBadge}>
              <Text style={styles.waitingBadgeText}>{t("bookings.waitingForVenue")}</Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.badgeText, { color: palette.fg }]}>{t(bookingFilterTranslationKey(item.displayStatus))}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

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
      <FlashList
        data={items}
        keyExtractor={(b) => b.id}
        estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.bookingCard}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={<Text style={styles.empty}>{t("bookings.noBookings")}</Text>}
        renderItem={renderItem}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={8}
        updateCellsBatchingPeriod={40}
      />
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
