import { AppPressable } from "@/shared/ui/app-pressable";
import { memo } from "react";
import { Alert, Linking, PixelRatio, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import {
  bookingListPriceParts,
  isFreeBookingEntry,
  useCancelBooking,
  type Booking,
  type BookingDisplayStatus,
} from "@/entities/booking";
import type { BookingsStackParamList } from "@/app/navigation/types";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import type { bookingsStaticStyles } from "./bookingsStyles";

export const BOOKING_THUMB_SIZE = 64;

function bookingFilterTranslationKey(status: BookingDisplayStatus): string {
  return status === "payment awaiting" ? "bookings.filter.paymentAwaiting" : `bookings.filter.${status}`;
}

export function bookingThumbUris(images: unknown, edgePx = BOOKING_THUMB_SIZE): { uri: string | null; fallbackUri: string | null } {
  const raw = getPrimaryBusinessCardImage(images);
  if (!raw) return { uri: null, fallbackUri: null };
  const edge = Math.round(edgePx * Math.min(2, PixelRatio.get()));
  const uri = getBusinessCardDisplayUrl(raw, { layoutPx: edge, layoutPxHeight: edge });
  return { uri, fallbackUri: businessCardDisplayFallback(uri, raw) ?? null };
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

export type BookingListItem = Booking & {
  displayStatus: BookingDisplayStatus;
  waPaymentLink: string | null;
  /** Price + currency from venue WhatsApp reply (`wa_confirmed_price`). */
  venueConfirmedPrice: string | null;
};

type BookingsScreenStyles = typeof bookingsStaticStyles;

type Props = {
  item: BookingListItem;
  styles: BookingsScreenStyles;
  isCompact: boolean;
};

function BookingListCardInner({ item, styles, isCompact }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const cancelBooking = useCancelBooking();

  const palette = statusPalette(item.displayStatus);
  const isFreeEntry = isFreeBookingEntry(Number(item.cost), item.venueConfirmedPrice);
  const showEntryUi = item.displayStatus !== "draft";
  const listPrice = showEntryUi && !isFreeEntry ? bookingListPriceParts(Number(item.cost), item.venueConfirmedPrice) : null;
  const entryPalette = isFreeEntry ? ENTRY_BADGE.free : ENTRY_BADGE.paid;
  const canCancel = item.displayStatus !== "cancelled" && item.displayStatus !== "completed";
  const canPay =
    (item.displayStatus === "confirmed" || item.displayStatus === "payment awaiting") &&
    item.payment_status === "pending" &&
    Boolean(item.waPaymentLink);
  const thumbEdge = isCompact ? 56 : BOOKING_THUMB_SIZE;
  const { uri: thumbUri, fallbackUri: thumbFallback } = bookingThumbUris(item.business_card?.images, thumbEdge);

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
      Alert.alert(
        t("bookings.cannotOpenPaymentLink"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    }
  };

  return (
    <AppPressable style={styles.card} onPress={() => navigation.navigate("PlaceDetail", { id: item.business_card_id })}>
      <SmartImage
        uri={thumbUri}
        fallbackUri={thumbFallback}
        bundledFallback={PLACE_IMAGE_FALLBACK}
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
            <AppPressable
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
            </AppPressable>
          ) : null}
        </View>
        <Text style={styles.meta}>{formatBookingDateTime(item.date_time)}</Text>
        {item.persons ? <Text style={styles.meta}>{t("bookings.persons", { count: item.persons })}</Text> : null}
        {item.comment ? <Text style={styles.meta}>{t("bookings.comment", { text: item.comment })}</Text> : null}
        {listPrice ? (
          <Text style={styles.priceFromVenue}>
            {listPrice.currency
              ? t("bookings.listPrice", { amount: listPrice.amount, currency: listPrice.currency })
              : t("bookings.listPrice", { amount: listPrice.amount, currency: "" }).trimEnd()}
          </Text>
        ) : null}
        {canPay ? (
          <AppPressable
            style={styles.payBtn}
            onPress={(event) => {
              event.stopPropagation?.();
              void openPaymentLink(item.waPaymentLink);
            }}
          >
            <Text style={styles.payBtnText}>{t("bookings.pay")}</Text>
          </AppPressable>
        ) : null}
        {item.displayStatus === "draft" ? (
          <View style={styles.waitingBadge}>
            <Text style={styles.waitingBadgeText}>{t("bookings.waitingForVenue")}</Text>
          </View>
        ) : null}
        <View style={styles.badgeRow}>
          {showEntryUi ? (
            <View style={[styles.badge, { backgroundColor: entryPalette.bg }]}>
              <Text style={[styles.badgeText, { color: entryPalette.fg }]}>
                {isFreeEntry ? t("bookings.freeEntry") : t("bookings.paidEntry")}
              </Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.badgeText, { color: palette.fg }]}>
              {t(bookingFilterTranslationKey(item.displayStatus))}
            </Text>
          </View>
        </View>
      </View>
    </AppPressable>
  );
}

export const BookingListCard = memo(BookingListCardInner);
