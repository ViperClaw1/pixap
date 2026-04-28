import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Alert, useWindowDimensions } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBookings,
  useCancelBooking,
  deriveBookingDisplayStatus,
  type Booking,
  type BookingDisplayStatus,
} from "@/hooks/useBookings";
import type { BookingsStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import AuthScreen from "@/screens/AuthScreen";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import { useCartItems } from "@/hooks/useCartItems";

type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingsMain">;

const filters: readonly BookingDisplayStatus[] = ["draft", "confirmed", "cancelled", "completed", "payment awaiting"];

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
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<BookingDisplayStatus>("draft");
  const { data: bookings = [] } = useBookings();
  const { data: cartItems = [] } = useCartItems();
  const cancelBooking = useCancelBooking();
  const isCompact = windowWidth < 400;

  const items = useMemo(() => {
    const cartMap = new Map(cartItems.map((item) => [`${item.business_card_id}|${item.date_time}`, item]));
    return bookings
      .map((booking) => ({
        ...booking,
        displayStatus: deriveBookingDisplayStatus(booking, cartMap.get(`${booking.business_card_id}|${booking.date_time}`)),
      }))
      .filter((item) => item.displayStatus === filter)
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  }, [bookings, cartItems, filter]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: { fontSize: 22, fontWeight: "800", paddingHorizontal: 16, color: colors.text },
        filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
        fpill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.border },
        fpillActive: { backgroundColor: colors.primary },
        fpillText: { fontSize: 12, textTransform: "capitalize", color: colors.text },
        fpillTextA: { fontSize: 12, color: colors.onPrimary, fontWeight: "700", textTransform: "capitalize" },
        card: {
          flexDirection: "row",
          gap: 12,
          padding: 12,
          backgroundColor: colors.card,
          borderRadius: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        name: { fontWeight: "700", color: colors.text, flexShrink: 1 },
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
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
          alignSelf: "flex-start",
          flexShrink: 0,
          minWidth: 72,
          alignItems: "center",
        },
        cancelBtnText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
      }),
    [colors],
  );

  if (loading) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
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

  const renderItem = ({ item }: { item: Booking & { displayStatus: BookingDisplayStatus } }) => {
    const palette = statusPalette(item.displayStatus);
    const canCancel = item.displayStatus !== "cancelled" && item.displayStatus !== "completed";
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
                  Alert.alert("Cancel booking", "Do you want to cancel this booking?", [
                    { text: "No", style: "cancel" },
                    {
                      text: "Yes, cancel",
                      style: "destructive",
                      onPress: () => {
                        void cancelBooking.mutateAsync(item.id);
                      },
                    },
                  ]);
                }}
              >
                <Text style={stylesThemed.cancelBtnText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={stylesThemed.meta}>{formatBookingDateTime(item.date_time)}</Text>
          {item.persons ? <Text style={stylesThemed.meta}>Persons: {item.persons}</Text> : null}
          {item.comment ? <Text style={stylesThemed.meta}>Comment: {item.comment}</Text> : null}
          {item.displayStatus !== "draft" ? (
            <Text style={stylesThemed.meta}>
              Payment: {item.payment_status === "pending" ? "Pending" : "Paid"}
            </Text>
          ) : null}
          {item.displayStatus === "draft" ? (
            <View style={stylesThemed.waitingBadge}>
              <Text style={stylesThemed.waitingBadgeText}>Waiting for venue response</Text>
            </View>
          ) : null}
          <View style={[stylesThemed.badge, { backgroundColor: palette.bg }]}>
            <Text style={[stylesThemed.badgeText, { color: palette.fg }]}>{item.displayStatus}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={stylesThemed.root}>
      <Text style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 12) }]}>Bookings</Text>
      <View style={stylesThemed.filters}>
        {filters.map((f) => (
          <Pressable
            key={f}
            style={[stylesThemed.fpill, filter === f && stylesThemed.fpillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? stylesThemed.fpillTextA : stylesThemed.fpillText}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        ListEmptyComponent={<Text style={stylesThemed.empty}>No bookings</Text>}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbCompact: { width: 56, height: 56 },
});
