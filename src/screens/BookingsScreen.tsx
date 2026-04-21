import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBookings,
  bookingScheduleLabel,
  type Booking,
  type BookingsTabFilter,
} from "@/hooks/useBookings";
import type { BookingsStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import AuthScreen from "@/screens/AuthScreen";

type Nav = NativeStackNavigationProp<BookingsStackParamList, "BookingsMain">;

const filters: readonly BookingsTabFilter[] = [undefined, "upcoming", "completed"];

export default function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<BookingsTabFilter>(undefined);
  const { data: bookings = [] } = useBookings(filter);

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
        name: { fontWeight: "700", color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        badge: { marginTop: 6, fontSize: 11, fontWeight: "600", textTransform: "uppercase", color: colors.link },
        empty: { textAlign: "center", color: colors.textMuted, marginTop: 32 },
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

  const renderItem = ({ item }: { item: Booking }) => (
    <Pressable
      style={stylesThemed.card}
      onPress={() => navigation.navigate("PlaceDetail", { id: item.business_card_id })}
    >
      <SmartImage uri={item.business_card?.image} recyclingKey={item.id} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={stylesThemed.name}>{item.business_card?.name}</Text>
        <Text style={stylesThemed.meta}>{new Date(item.date_time).toLocaleString()}</Text>
        {item.persons ? <Text style={stylesThemed.meta}>Persons: {item.persons}</Text> : null}
        {item.comment ? <Text style={stylesThemed.meta}>Comment: {item.comment}</Text> : null}
        <Text style={stylesThemed.meta}>
          Payment: {item.payment_status === "pending" ? "Pending" : "Paid"}
        </Text>
        <Text style={stylesThemed.badge}>{bookingScheduleLabel(item.date_time)}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={stylesThemed.root}>
      <Text style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 12) }]}>Bookings</Text>
      <View style={stylesThemed.filters}>
        {filters.map((f) => (
          <Pressable
            key={f ?? "all"}
            style={[stylesThemed.fpill, filter === f && stylesThemed.fpillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? stylesThemed.fpillTextA : stylesThemed.fpillText}>{f ?? "All"}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={bookings}
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
});
