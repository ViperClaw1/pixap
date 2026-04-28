import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { CommonActions, useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBusinessCard } from "@/hooks/useBusinessCards";
import { useCreateCartItem } from "@/hooks/useCartItems";
import { useCreateBooking } from "@/hooks/useBookings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { BrowseFlowParamList } from "@/navigation/types";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/theme/primaryPressable";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";
import { BookingFlowPlacePanel } from "@/components/booking/BookingFlowPlacePanel";

const timeSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const CALENDAR_MONTHS_AHEAD = 6;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
type CalendarCell = { kind: "pad" } | { kind: "day"; ymd: string; day: number };

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function firstOfMonthContaining(d: Date): Date {
  const x = startOfLocalDay(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const lead = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ kind: "pad" });
  for (let d = 1; d <= dim; d++) {
    cells.push({ kind: "day", day: d, ymd: toYmd(new Date(year, month, d)) });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "pad" });
  return cells;
}

function chunkCells<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function profileString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type R = RouteProp<BrowseFlowParamList, "BookingFlow">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "BookingFlow">;

export default function BookingFlowScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { session, user } = useAuth();
  const { data: place } = useBusinessCard(id);
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();

  const [step, setStep] = useState(0);
  const [selectedDateYmd, setSelectedDateYmd] = useState(() => toYmd(new Date()));
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState<Date>(() => firstOfMonthContaining(new Date()));
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(2);
  const selectedDate = useMemo(() => fromYmd(selectedDateYmd), [selectedDateYmd]);

  if (!place) return null;

  const totalSteps = 2;
  const todayYmd = toYmd(startOfLocalDay(new Date()));
  const earliestBookableMonth = firstOfMonthContaining(new Date());
  const latestBookableMonth = new Date(
    earliestBookableMonth.getFullYear(),
    earliestBookableMonth.getMonth() + CALENDAR_MONTHS_AHEAD,
    1,
  );
  const canGoPrevMonth = monthKey(visibleCalendarMonth) > monthKey(earliestBookableMonth);
  const canGoNextMonth = monthKey(visibleCalendarMonth) < monthKey(latestBookableMonth);
  const calendarCells = useMemo(
    () => buildMonthCells(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth()),
    [visibleCalendarMonth],
  );
  const onFavoritePress = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const handleConfirm = async () => {
    const dateTime = new Date(selectedDate);
    const [h, m] = selectedTime.split(":").map(Number);
    dateTime.setHours(h, m, 0, 0);
    const customerName =
      profileString(user?.user_metadata?.full_name) ??
      profileString(user?.email?.split("@")[0]) ??
      "Client";
    const customerPhone =
      profileString(user?.user_metadata?.phone) ??
      profileString(user?.phone) ??
      null;
    try {
      const price = Number(place.booking_price);
      await createBooking.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: price,
        persons: guests,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_status: price > 0 ? "pending" : "paid",
        status: "upcoming",
      });
      const createdCartItem = await createCartItem.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: price,
        persons: guests,
        customer_name: customerName,
        customer_phone: customerPhone,
        is_restaurant_table: false,
      });
      const accessToken = session?.access_token;
      if (accessToken && createdCartItem?.id) {
        void supabase.functions
          .invoke("n8n-wa-booking-start", {
            body: { cart_item_id: createdCartItem.id },
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .then((res) => {
            const { error, data } = res;
            if (!error) return;
            let details = error.message;
            const rawBody = (error as { context?: { body?: string } }).context?.body;
            if (rawBody) {
              try {
                const parsed = JSON.parse(rawBody) as { error?: string; step?: string; hint?: string };
                details = `${parsed.error ?? error.message}${parsed.step ? ` [${parsed.step}]` : ""}${
                  parsed.hint ? ` — ${parsed.hint}` : ""
                }`;
              } catch {
                details = `${details} ${rawBody.slice(0, 220)}`;
              }
            } else if (data && typeof data === "object" && data !== null && "error" in data) {
              const parsed = data as { error?: string; step?: string; hint?: string };
              details = `${parsed.error ?? error.message}${parsed.step ? ` [${parsed.step}]` : ""}${
                parsed.hint ? ` — ${parsed.hint}` : ""
              }`;
            }
            console.warn("[n8n-wa-booking-start] invoke failed", details);
          })
          .catch((error) => {
            if (__DEV__) {
              console.warn("[n8n-wa-booking-start] invoke failed", error);
            }
          });
      }
      Alert.alert(
        price > 0 ? "Draft created" : "Booking confirmed",
        price > 0
          ? "Draft booking was added to Bookings. Venue check is started in background."
          : "Your booking is now in Bookings.",
      );
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      Alert.alert("Failed to add to cart");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {step === 1 ? (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable onPress={() => setStep(step - 1)}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>Book {place.name}</Text>
            <Text style={styles.stepText}>
              Step {step + 1} of {totalSteps + 1}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {step === 0 && (
          <View>
            <BookingFlowPlacePanel
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                booking_price: place.booking_price,
                images: place.images,
              }}
              colors={colors}
              heroTopInset={Math.max(insets.top, 10)}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={() => navigation.goBack()}
            >
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
            </BookingFlowPlacePanel>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.section}>Select date & time</Text>
            <View style={styles.calendarPanel}>
              <View style={styles.calendarNav}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={!canGoPrevMonth}
                  onPress={() =>
                    setVisibleCalendarMonth((prev) => {
                      const y = prev.getFullYear();
                      const m = prev.getMonth();
                      return new Date(y, m - 1, 1);
                    })
                  }
                  style={[styles.calendarNavBtn, !canGoPrevMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>
                  {visibleCalendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  disabled={!canGoNextMonth}
                  onPress={() =>
                    setVisibleCalendarMonth((prev) => {
                      const y = prev.getFullYear();
                      const m = prev.getMonth();
                      return new Date(y, m + 1, 1);
                    })
                  }
                  style={[styles.calendarNavBtn, !canGoNextMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </Pressable>
              </View>
              <View style={styles.calendarDowRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.calendarDowCell}>
                    {label}
                  </Text>
                ))}
              </View>
              {chunkCells(calendarCells, 7).map((row, rowIdx) => (
                <View key={`w-${rowIdx}`} style={styles.calendarWeekRow}>
                  {row.map((cell, colIdx) => {
                    if (cell.kind === "pad") {
                      return <View key={`p-${rowIdx}-${colIdx}`} style={styles.calendarCell} />;
                    }
                    const { ymd, day } = cell;
                    const isSelected = selectedDateYmd === ymd;
                    const isToday = ymd === todayYmd;
                    const isPast = ymd < todayYmd;
                    return (
                      <View key={ymd} style={styles.calendarCell}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${ymd}`}
                          disabled={isPast}
                          onPress={() => setSelectedDateYmd(ymd)}
                          style={[
                            styles.calendarCellDayInner,
                            isToday && styles.calendarCellToday,
                            isSelected && styles.calendarCellSelected,
                            isPast && styles.calendarCellPast,
                          ]}
                        >
                          <Text style={styles.calendarCellDayText}>{day}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
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
            <BookingFlowPlacePanel
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                booking_price: place.booking_price,
                images: place.images,
              }}
              colors={colors}
              heroTopInset={Math.max(insets.top, 10)}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={() => setStep(step - 1)}
            >
              <Text style={styles.section}>Confirm</Text>
              <Text>
                {guests} guests · {selectedDate.toDateString()} {selectedTime}
              </Text>
              <Text style={{ marginTop: 8 }}>{Number(place.booking_price).toLocaleString()} $</Text>
            </BookingFlowPlacePanel>
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
            <Text style={styles.primaryText}>Confirm booking</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  stepContent: { paddingHorizontal: 16, paddingTop: 16 },
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
  calendarPanel: {
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarNavBtn: { padding: 8, borderRadius: 8 },
  calendarNavBtnDisabled: { opacity: 0.35 },
  calendarMonthTitle: { fontWeight: "800", fontSize: 16 },
  calendarDowRow: { flexDirection: "row", marginBottom: 4 },
  calendarDowCell: {
    flex: 1,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
  },
  calendarWeekRow: { flexDirection: "row", alignItems: "center" },
  calendarCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  calendarCellDayInner: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  calendarCellDayText: { color: "#111", fontSize: 15, fontWeight: "700" },
  calendarCellToday: { borderStyle: "dashed", borderColor: "#d1d5db" },
  calendarCellSelected: { borderColor: "#111", backgroundColor: "#f3f4f6" },
  calendarCellPast: { opacity: 0.38 },
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
  primary: primaryPressableStyle,
  primaryText: primaryPressableTextStyle,
});
