import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/hooks/useBusinessCards";
import { useCreateCartItem } from "@/hooks/useCartItems";
import type { BrowseFlowParamList } from "@/navigation/types";
import { navigateToCartMain } from "@/navigation/navigationHelpers";

const timeSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

type R = RouteProp<BrowseFlowParamList, "BookingFlow">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "BookingFlow">;

export default function BookingFlowScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: place } = useBusinessCard(id);
  const createCartItem = useCreateCartItem();

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(2);

  if (!place) return null;

  const totalSteps = 2;

  const isRestaurantBooking =
    (place.tags ?? []).some((t) => /restaurant/i.test(String(t))) ||
    (place.category?.name?.toLowerCase().includes("restaurant") ?? false);

  const handleConfirm = async () => {
    const dateTime = new Date(selectedDate);
    const [h, m] = selectedTime.split(":").map(Number);
    dateTime.setHours(h, m, 0, 0);
    try {
      await createCartItem.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: Number(place.booking_price),
        persons: guests,
        is_restaurant_table: isRestaurantBooking,
      });
      Alert.alert("Added to cart");
      navigateToCartMain(navigation, {
        autoWhatsApp: {
          kind: isRestaurantBooking ? "restaurant" : "service",
          businessCardId: place.id,
        },
      });
    } catch {
      Alert.alert("Failed to add to cart");
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Book {place.name}</Text>
          <Text style={styles.stepText}>
            Step {step + 1} of {totalSteps + 1}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
        {step === 0 && (
          <View>
            <Text style={styles.section}>Number of guests</Text>
            <View style={styles.guestRow}>
              <Pressable style={styles.guestBtn} onPress={() => setGuests(Math.max(1, guests - 1))}>
                <Text style={styles.guestBtnText}>−</Text>
              </Pressable>
              <Text style={styles.guestCount}>{guests}</Text>
              <Pressable style={styles.guestBtn} onPress={() => setGuests(Math.min(20, guests + 1))}>
                <Text style={styles.guestBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.section}>Select date & time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dates.map((d) => {
                const sel = d.toDateString() === selectedDate.toDateString();
                return (
                  <Pressable
                    key={d.toISOString()}
                    style={[styles.datePill, sel && styles.datePillSel]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={[styles.datePillSmall, sel && styles.datePillTextSel]}>
                      {d.toLocaleDateString("en", { weekday: "short" })}
                    </Text>
                    <Text style={[styles.datePillNum, sel && styles.datePillTextSel]}>{d.getDate()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.timeGrid}>
              {timeSlots.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.timeCell, selectedTime === t && styles.timeCellSel]}
                  onPress={() => setSelectedTime(t)}
                >
                  <Text style={selectedTime === t ? styles.timeCellTextSel : undefined}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.section}>Confirm</Text>
            <Text>
              {guests} guests · {selectedDate.toDateString()} {selectedTime}
            </Text>
            <Text style={{ marginTop: 8 }}>{Number(place.booking_price).toLocaleString()} ₸</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step < totalSteps ? (
          <Pressable
            style={styles.primary}
            onPress={() => {
              if (step === 1 && !selectedTime) {
                Alert.alert("Pick a time");
                return;
              }
              setStep(step + 1);
            }}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primary} onPress={() => void handleConfirm()}>
            <Text style={styles.primaryText}>Add to cart</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: "700" },
  stepText: { fontSize: 12, color: "#888" },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  guestRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 24 },
  guestBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: { fontSize: 22 },
  guestCount: { fontSize: 40, fontWeight: "800", width: 48, textAlign: "center" },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    alignItems: "center",
  },
  datePillSel: { backgroundColor: "#111" },
  datePillSmall: { fontSize: 10, textTransform: "uppercase" },
  datePillNum: { fontSize: 18, fontWeight: "700" },
  datePillTextSel: { color: "#fff" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  timeCell: {
    width: "22%",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  timeCellSel: { backgroundColor: "#111" },
  timeCellTextSel: { color: "#fff", fontWeight: "600" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#eee" },
  primary: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
});
