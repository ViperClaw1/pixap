import { AppPressable } from "@/shared/ui/app-pressable";
import { useMemo } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAuth } from "@/app/providers/AuthProvider";
import type { BookingsStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import {
  bookingListPriceParts,
  deriveBookingDisplayStatus,
  isFreeBookingEntry,
  isWaVenueUnavailable,
  linkCartItemForBooking,
  useBooking,
  useCancelBooking,
  venueConfirmedPriceLabel,
  type BookingDisplayStatus,
} from "@/entities/booking";
import { useCartItems, parseWaStatusLines } from "@/entities/cart";
import { getBusinessCardCoverBlurhash } from "@/shared/lib/business-card/businessCardBlurhash";
import { bookingThumbUris } from "@/pages/bookings/ui/BookingListCard";
import { bookingDetailStaticStyles, bookingDetailThemeStyles } from "./bookingDetailStyles";

type Route = RouteProp<BookingsStackParamList, "BookingDetail">;
type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingDetail">;

type TimelineStyles = Pick<
  typeof bookingDetailStaticStyles,
  "meta" | "statusTimeline" | "timelineRow" | "timelineDot" | "timelineDotActive" | "timelineText"
>;

function BookingStatusTimeline({
  lines,
  fallback,
  styles,
}: {
  lines: string[];
  fallback: string;
  styles: TimelineStyles;
}) {
  if (lines.length === 0) {
    return <Text style={styles.meta}>{fallback}</Text>;
  }
  return (
    <View style={styles.statusTimeline}>
      {lines.map((line, idx) => (
        <View key={idx} style={styles.timelineRow}>
          <View style={[styles.timelineDot, idx === lines.length - 1 ? styles.timelineDotActive : null]} />
          <Text style={styles.timelineText}>{line}</Text>
        </View>
      ))}
    </View>
  );
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

function statusTranslationKey(status: BookingDisplayStatus): string {
  return status === "payment awaiting" ? "bookings.filter.paymentAwaiting" : `bookings.filter.${status}`;
}

const ENTRY_BADGE = {
  free: { bg: "#EDE9FE", fg: "#5B21B6" },
  paid: { bg: "#FFEDD5", fg: "#C2410C" },
} as const;

const STATUS_BADGE = {
  success: { bg: "#DCFCE7", fg: "#166534" },
  danger: { bg: "#FEE2E2", fg: "#991B1B" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
} as const;

function statusPalette(status: BookingDisplayStatus) {
  switch (status) {
    case "confirmed":
    case "completed":
      return STATUS_BADGE.success;
    case "cancelled":
      return STATUS_BADGE.danger;
    case "draft":
      return STATUS_BADGE.warning;
    case "payment awaiting":
    default:
      return STATUS_BADGE.warning;
  }
}

export default function BookingDetailPage() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, loading: authLoading } = useAuth();
  const bookingId = route.params.bookingId;
  const { data: booking, isPending, isError } = useBooking(bookingId);
  const { data: cartItems = [] } = useCartItems();
  const cancelBooking = useCancelBooking();

  useAuthSessionRedirect({
    authLoading,
    hasUser: Boolean(user),
    navigation,
  });

  const themed = useThemeStyles(({ colors: c }) => bookingDetailThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(bookingDetailStaticStyles, themed),
    [themed],
  );

  const linkedCartItem = booking ? linkCartItemForBooking(booking, cartItems) : null;
  const displayStatus = booking ? deriveBookingDisplayStatus(booking, linkedCartItem) : null;
  const venueDeclined = Boolean(linkedCartItem && isWaVenueUnavailable(linkedCartItem));
  const palette = displayStatus ? statusPalette(displayStatus) : STATUS_BADGE.warning;
  const isFreeEntry = booking
    ? isFreeBookingEntry(Number(booking.cost), venueConfirmedPriceLabel(linkedCartItem?.wa_confirmed_price))
    : false;
  const showEntryUi = displayStatus !== "draft";
  const venueConfirmedPrice = venueConfirmedPriceLabel(linkedCartItem?.wa_confirmed_price);
  const listPrice =
    booking && !isFreeEntry
      ? bookingListPriceParts(Number(booking.cost), venueConfirmedPrice)
      : null;
  const entryPalette = isFreeEntry ? ENTRY_BADGE.free : ENTRY_BADGE.paid;
  const waPaymentLink = linkedCartItem?.wa_payment_link?.trim() || null;
  const canCancel = displayStatus !== "cancelled" && displayStatus !== "completed";
  const canPay =
    (displayStatus === "confirmed" || displayStatus === "payment awaiting") &&
    booking?.payment_status === "pending" &&
    Boolean(waPaymentLink);

  const { uri: heroUri, fallbackUri: heroFallback } = bookingThumbUris(booking?.business_card?.images, 400);
  const coverBlurhash = getBusinessCardCoverBlurhash(booking?.business_card?.blurhashes);

  const openPaymentLink = async () => {
    if (!waPaymentLink) {
      Alert.alert(t("bookings.paymentLinkMissingTitle"), t("bookings.paymentLinkMissingBody"));
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(waPaymentLink);
      if (!canOpen) {
        Alert.alert(t("bookings.cannotOpenPaymentLink"), waPaymentLink);
        return;
      }
      await Linking.openURL(waPaymentLink);
    } catch (error) {
      Alert.alert(
        t("bookings.cannotOpenPaymentLink"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    }
  };

  if (!user && !authLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        title={t("bookingDetail.title")}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
      />
      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError || !booking ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("bookingDetail.notFound")}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        >
          <AppPressable onPress={() => navigation.navigate("PlaceDetail", { id: booking.business_card_id })}>
            <SmartImage
              uri={heroUri}
              fallbackUri={heroFallback}
              bundledFallback={PLACE_IMAGE_FALLBACK}
              recyclingKey={`booking-detail-${booking.id}`}
              style={styles.hero}
              contentFit="cover"
              blurhash={coverBlurhash}
            />
          </AppPressable>

          <View style={styles.section}>
            <AppPressable onPress={() => navigation.navigate("PlaceDetail", { id: booking.business_card_id })}>
              <Text style={styles.venueName}>{booking.business_card?.name ?? t("bookings.defaultVenueName")}</Text>
            </AppPressable>
            <Text style={styles.meta}>{formatBookingDateTime(booking.date_time)}</Text>
            {booking.persons ? <Text style={styles.meta}>{t("bookings.persons", { count: booking.persons })}</Text> : null}
            {booking.comment ? <Text style={styles.meta}>{t("bookings.comment", { text: booking.comment })}</Text> : null}
            {booking.customer_name ? (
              <Text style={styles.meta}>{t("bookingDetail.guestName", { name: booking.customer_name })}</Text>
            ) : null}
            {booking.customer_phone ? (
              <Text style={styles.meta}>{t("bookingDetail.guestPhone", { phone: booking.customer_phone })}</Text>
            ) : null}
            {listPrice ? (
              <Text style={styles.price}>
                {listPrice.currency
                  ? t("bookings.listPrice", { amount: listPrice.amount, currency: listPrice.currency })
                  : t("bookings.listPrice", { amount: listPrice.amount, currency: "" }).trimEnd()}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              {showEntryUi ? (
                <View style={[styles.badge, { backgroundColor: entryPalette.bg }]}>
                  <Text style={[styles.badgeText, { color: entryPalette.fg }]}>
                    {isFreeEntry ? t("bookings.freeEntry") : t("bookings.paidEntry")}
                  </Text>
                </View>
              ) : null}
              {displayStatus ? (
                <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.badgeText, { color: palette.fg }]}>
                    {t(statusTranslationKey(displayStatus))}
                  </Text>
                </View>
              ) : null}
            </View>
            {displayStatus === "draft" ? (
              <BookingStatusTimeline
                lines={parseWaStatusLines(linkedCartItem?.wa_status_lines)}
                fallback={t("bookings.waitingForVenue")}
                styles={styles}
              />
            ) : null}
            {displayStatus === "cancelled" && venueDeclined ? (
              <Text style={styles.meta}>{t("bookings.venueDeclinedHint")}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {canPay ? (
              <AppPressable style={styles.primaryBtn} onPress={() => void openPaymentLink()}>
                <Text style={styles.primaryBtnText}>{t("bookings.pay")}</Text>
              </AppPressable>
            ) : null}
            {canCancel ? (
              <AppPressable
                style={styles.secondaryBtn}
                onPress={() => {
                  Alert.alert(t("bookings.cancelBookingTitle"), t("bookings.cancelBookingMessage"), [
                    { text: t("bookings.no"), style: "cancel" },
                    {
                      text: t("bookings.yesCancel"),
                      style: "destructive",
                      onPress: () => {
                        void cancelBooking.mutateAsync(booking.id);
                        navigation.goBack();
                      },
                    },
                  ]);
                }}
              >
                <Text style={styles.secondaryBtnText}>{t("bookings.cancel")}</Text>
              </AppPressable>
            ) : null}
            <AppPressable
              style={styles.linkBtn}
              onPress={() => navigation.navigate("PlaceDetail", { id: booking.business_card_id })}
            >
              <Text style={styles.linkBtnText}>{t("bookingDetail.openVenue")}</Text>
            </AppPressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
