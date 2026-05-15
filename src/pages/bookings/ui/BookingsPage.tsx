import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
} from "react-native";
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
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { useCartItems } from "@/entities/cart";
import { bookingStatusNotificationText, useCreateNotification } from "@/entities/notification";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";

type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingsMain">;

const filters: readonly BookingDisplayStatus[] = ["draft", "confirmed", "cancelled", "completed", "payment awaiting"];

function bookingFilterTranslationKey(status: BookingDisplayStatus): string {
  return status === "payment awaiting" ? "bookings.filter.paymentAwaiting" : `bookings.filter.${status}`;
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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
        fpill: {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        fpillActive: { backgroundColor: colors.text, borderColor: colors.text },
        fpillText: { fontSize: 11, textTransform: "capitalize", color: colors.text, fontWeight: "600" },
        fpillTextA: { fontSize: 11, color: colors.background, fontWeight: "700", textTransform: "capitalize" },
        card: {
          flexDirection: "row",
          gap: 12,
          padding: 12,
          backgroundColor: colors.card,
          borderRadius: 14,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        name: { fontWeight: "700", color: colors.text, flexShrink: 1, fontSize: 15 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        badge: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
        badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
        waitingBadge: {
          marginTop: 6,
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: colors.border,
        },
        waitingBadgeText: {
          fontSize: 10,
          fontWeight: "700",
          color: colors.textMuted,
        },
        empty: { textAlign: "center", color: colors.textMuted, marginTop: 32 },
        rowHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
        rowHeadLeft: { flex: 1, minWidth: 0, paddingRight: 4 },
        cancelBtn: {
          borderWidth: 1,
          borderColor: colors.danger,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: "flex-start",
          flexShrink: 0,
          minWidth: 64,
          alignItems: "center",
        },
        cancelBtnText: { color: colors.danger, fontSize: 11, fontWeight: "700" },
        payBtn: {
          marginTop: 10,
          alignSelf: "flex-start",
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        payBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
      }),
    [colors, insets.bottom],
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
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textMuted }}>{t("bookings.loading")}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
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
    return (
      <Pressable
        style={stylesThemed.card}
        onPress={() => navigation.navigate("PlaceDetail", { id: item.business_card_id })}
      >
        <SmartImage
          uri={getLatestBusinessCardImage(item.business_card?.images)}
          recyclingKey={item.id}
          style={[styles.thumb, isCompact ? styles.thumbCompact : null]}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <View style={stylesThemed.rowHead}>
            <View style={stylesThemed.rowHeadLeft}>
              <Text style={stylesThemed.name} numberOfLines={isCompact ? 2 : 1}>
                {item.business_card?.name}
              </Text>
            </View>
            {canCancel ? (
              <Pressable
                style={stylesThemed.cancelBtn}
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
                <Text style={stylesThemed.cancelBtnText}>{t("bookings.cancel")}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={stylesThemed.meta}>{formatBookingDateTime(item.date_time)}</Text>
          {item.persons ? <Text style={stylesThemed.meta}>{t("bookings.persons", { count: item.persons })}</Text> : null}
          {item.comment ? <Text style={stylesThemed.meta}>{t("bookings.comment", { text: item.comment })}</Text> : null}
          {item.displayStatus !== "draft" ? (
            <Text style={stylesThemed.meta}>
              {t("bookings.payment", {
                state: item.payment_status === "pending" ? t("bookings.paymentPending") : t("bookings.paymentPaid"),
              })}
            </Text>
          ) : null}
          {canPay ? (
            <Pressable
              style={stylesThemed.payBtn}
              onPress={(event) => {
                event.stopPropagation?.();
                void openPaymentLink(item.waPaymentLink);
              }}
            >
              <Text style={stylesThemed.payBtnText}>{t("bookings.pay")}</Text>
            </Pressable>
          ) : null}
          {item.displayStatus === "draft" ? (
            <View style={stylesThemed.waitingBadge}>
              <Text style={stylesThemed.waitingBadgeText}>{t("bookings.waitingForVenue")}</Text>
            </View>
          ) : null}
          <View style={[stylesThemed.badge, { backgroundColor: palette.bg }]}>
            <Text style={[stylesThemed.badgeText, { color: palette.fg }]}>{t(bookingFilterTranslationKey(item.displayStatus))}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={stylesThemed.root}>
      <AppHeader
        title={t("header.bookings")}
        leftIcon="add"
        onLeftPress={() => setPlacePickerOpen(true)}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
        notificationsEnabled
      />
      <View style={stylesThemed.filters}>
        {filters.map((f) => (
          <Pressable
            key={f}
            style={[stylesThemed.fpill, filter === f && stylesThemed.fpillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? stylesThemed.fpillTextA : stylesThemed.fpillText}>{t(bookingFilterTranslationKey(f))}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={<Text style={stylesThemed.empty}>{t("bookings.noBookings")}</Text>}
        renderItem={renderItem}
      />
      <BottomSheetPickerModal visible={placePickerOpen} onClose={() => setPlacePickerOpen(false)} title={t("bookings.choosePlace")}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
          {businessCards.length ? (
            businessCards.map((item) => (
              <View key={item.id} style={stylesThemed.card}>
                <SmartImage
                  uri={getLatestBusinessCardImage(item.images)}
                  recyclingKey={`book-place-${item.id}`}
                  style={[styles.thumb, isCompact ? styles.thumbCompact : null]}
                  contentFit="cover"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={stylesThemed.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={stylesThemed.meta} numberOfLines={2}>
                    {item.tags?.slice(0, 4).join(", ") || t("bookings.noTags")}
                  </Text>
                </View>
                <Pressable
                  style={stylesThemed.payBtn}
                  onPress={() => {
                    setPlacePickerOpen(false);
                    navigation.navigate("BookingFlow", { id: item.id });
                  }}
                >
                  <Text style={stylesThemed.payBtnText}>{t("bookings.book")}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={stylesThemed.empty}>{t("bookings.noPlacesYet")}</Text>
          )}
        </ScrollView>
      </BottomSheetPickerModal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbCompact: { width: 56, height: 56 },
});
