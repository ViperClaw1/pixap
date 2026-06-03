import { AppPressable } from "@/shared/ui/app-pressable";
import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { CommonActions, useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBusinessCard } from "@/entities/business-card";
import { useCreateCartItem, useStartN8nWaBooking } from "@/entities/cart";
import { useAvailableSlots, useCreateBooking } from "@/entities/booking";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { bookingFlowThemedStaticStyles, bookingFlowThemedThemeStyles } from "./bookingFlowThemeStyles";
import { useIsFavorite, useToggleFavorite } from "@/entities/favorite";
import { BookingFlowPlacePanel } from "@/shared/ui/booking-place-panel";
import { isProfileComplete } from "@/shared/lib/profileCompletion";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { devWarn } from "@/shared/lib/devLog";
import { appAlert } from "@/shared/ui/app-popup";
import { isInsufficientBookingCreditsError } from "@/entities/booking-credits";
import { useBookingAccess } from "@/features/booking-access";
import {
  shouldEnforceSubscriptionPaywall,
  useSubscriptionPaywallRedirect,
} from "@/features/subscription-paywall-redirect";
import {
  BOOKING_FLOW_DEFAULT_GUESTS,
  BOOKING_FLOW_MAX_GUESTS,
  BOOKING_FLOW_MIN_GUESTS,
  BOOKING_FLOW_TOTAL_STEPS,
} from "../model/constants";
import { BOOKING_SLOT_GRID_COLUMNS } from "@/entities/booking/lib/bookingSlots";

import {
  CALENDAR_MONTHS_AHEAD,
  WEEKDAY_LABELS,
  startOfLocalDay,
  toYmd,
  fromYmd,
  monthKey,
  firstOfMonthContaining,
  buildMonthCells,
  chunkCells,
} from "@/shared/lib/bookingCalendar";

function profileString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type R = RouteProp<BrowseFlowParamList, "BookingFlow">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "BookingFlow">;

export default function BookingFlowPage() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  useDisableGestureDuringTransition();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    sensitivity: "high",
  });
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { session, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: place, isLoading: placeLoading } = useBusinessCard(id);
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const createCartItem = useCreateCartItem();
  const createBooking = useCreateBooking();
  const startN8nWaBooking = useStartN8nWaBooking();
  const { t } = useTranslation();
  const {
    canAccessBookingFlow,
    isLoading: accessLoading,
    canUseBookingCredits,
  } = useBookingAccess();
  const shouldEnforcePaywall = shouldEnforceSubscriptionPaywall();
  useSubscriptionPaywallRedirect({
    accessLoading,
    shouldEnforcePaywall,
    hasAccess: canAccessBookingFlow,
    paywallReason: !canUseBookingCredits ? "no_credits" : "upgrade",
    navigation: navigation as {
      replace: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void;
    },
  });

  const [step, setStep] = useState(0);
  const [selectedDateYmd, setSelectedDateYmd] = useState(() => toYmd(new Date()));
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState<Date>(() => firstOfMonthContaining(new Date()));
  const [selectedTime, setSelectedTime] = useState("");
  const [guests, setGuests] = useState(BOOKING_FLOW_DEFAULT_GUESTS);
  const [confirming, setConfirming] = useState(false);
  const useMonotoneDarkBackground = isDark && (step === 0 || step === 2);
  const selectedDate = useMemo(() => fromYmd(selectedDateYmd), [selectedDateYmd]);
  const themed = useThemeStyles(({ colors: c, isDark: dark }) => bookingFlowThemedThemeStyles(c, dark));
  const themedStyles = useMemo(
    () => mergeStaticAndThemed(bookingFlowThemedStaticStyles, themed),
    [themed],
  );
  const calendarCells = useMemo(
    () => buildMonthCells(visibleCalendarMonth.getFullYear(), visibleCalendarMonth.getMonth()),
    [visibleCalendarMonth],
  );
  const {
    data: slotsForDate = [],
    isFetching: slotsFetching,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailableSlots(id, selectedDateYmd);
  const selectedAvailableSlot = useMemo(
    () => slotsForDate.find((slot) => slot.label === selectedTime && slot.available) ?? null,
    [selectedTime, slotsForDate],
  );

  if (placeLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!place) return null;

  if (accessLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (shouldEnforcePaywall && !canAccessBookingFlow) {
    return null;
  }

  const todayYmd = toYmd(startOfLocalDay(new Date()));
  const earliestBookableMonth = firstOfMonthContaining(new Date());
  const latestBookableMonth = new Date(
    earliestBookableMonth.getFullYear(),
    earliestBookableMonth.getMonth() + CALENDAR_MONTHS_AHEAD,
    1,
  );
  const canGoPrevMonth = monthKey(visibleCalendarMonth) > monthKey(earliestBookableMonth);
  const canGoNextMonth = monthKey(visibleCalendarMonth) < monthKey(latestBookableMonth);
  const onFavoritePress = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const handleConfirm = async () => {
    if (confirming) return;
    if (!canUseBookingCredits) {
      Alert.alert(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
      return;
    }
    if (!isProfileComplete(profile)) {
      Alert.alert("Profile incomplete", "Please, fill out all your profile data before booking.");
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Profile",
          params: { screen: "EditProfile" },
        }),
      );
      return;
    }
    if (!selectedAvailableSlot) {
      Alert.alert("Pick an available time");
      return;
    }
    const dateTime = new Date(selectedAvailableSlot.dateTimeIso);
    const customerName =
      profileString(user?.user_metadata?.full_name) ??
      profileString(user?.email?.split("@")[0]) ??
      "Client";
    const customerPhone =
      profileString(user?.user_metadata?.phone) ??
      profileString(user?.phone) ??
      null;
    setConfirming(true);
    try {
      const price = Number(place.booking_price);
      await createBooking.mutateAsync({
        business_card_id: place.id,
        date_time: dateTime.toISOString(),
        cost: price,
        persons: guests,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_status: "pending",
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
        void startN8nWaBooking.mutateAsync({ cartItemId: createdCartItem.id, accessToken }).catch((error) => {
          if (__DEV__) {
            devWarn("[n8n-wa-booking-start] invoke failed", error instanceof Error ? error.message : error);
          }
        });
      }
      appAlert(
        "Draft created",
        "Draft booking was added to Bookings. Venue check is started in background.",
        undefined,
        "success",
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
      if (isInsufficientBookingCreditsError(error)) {
        Alert.alert(t("bookingCredits.noCreditsTitle"), t("bookingCredits.noCreditsMessage"));
        return;
      }
      Alert.alert("Failed to add to cart");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} {...androidSwipeBackPanHandlers}>
      {step === 1 ? (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <AppPressable onPress={() => setStep(step - 1)}>
            <Text style={[styles.back, themedStyles.headerBack]}>←</Text>
          </AppPressable>
          <View>
            <Text style={[styles.title, themedStyles.headerTitle]}>Book {place.name}</Text>
            <Text style={[styles.stepText, themedStyles.headerStep]}>
              Step {step + 1} of {BOOKING_FLOW_TOTAL_STEPS + 1}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
          <View style={styles.stepContent}>
            <Text style={[styles.section, themedStyles.sectionText]}>Select date & time</Text>
            <View style={[styles.calendarPanel, themedStyles.calendarPanel]}>
              <View style={styles.calendarNav}>
                <AppPressable
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
                  style={[styles.calendarNavBtn, themedStyles.calendarNavBtn, !canGoPrevMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={22} color={canGoPrevMonth ? colors.text : colors.textMuted} />
                </AppPressable>
                <Text style={[styles.calendarMonthTitle, themedStyles.calendarMonthTitle]}>
                  {visibleCalendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <AppPressable
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
                  style={[styles.calendarNavBtn, themedStyles.calendarNavBtn, !canGoNextMonth && styles.calendarNavBtnDisabled]}
                >
                  <Ionicons name="chevron-forward" size={22} color={canGoNextMonth ? colors.text : colors.textMuted} />
                </AppPressable>
              </View>
              <View style={styles.calendarDowRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={[styles.calendarDowCell, themedStyles.calendarDowCell]}>
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
                        <AppPressable
                          accessibilityRole="button"
                          accessibilityLabel={`${ymd}`}
                          disabled={isPast}
                          onPress={() => {
                            setSelectedDateYmd(ymd);
                            setSelectedTime("");
                          }}
                          style={[
                            styles.calendarCellDayInner,
                            themedStyles.calendarCellDayInner,
                            isToday && styles.calendarCellToday,
                            isToday && themedStyles.calendarCellToday,
                            isSelected && styles.calendarCellSelected,
                            isSelected && themedStyles.calendarCellSelected,
                            isPast && styles.calendarCellPast,
                            isPast && themedStyles.calendarCellPast,
                          ]}
                        >
                          <Text style={[styles.calendarCellDayText, themedStyles.calendarCellDayText, isPast && themedStyles.calendarCellPastText]}>
                            {day}
                          </Text>
                        </AppPressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            {slotsFetching ? (
              <ActivityIndicator style={styles.slotsLoading} color={colors.primary} />
            ) : slotsError ? (
              <View style={styles.slotsError}>
                <Text style={themedStyles.headerStep}>Could not load available slots.</Text>
                <AppPressable style={styles.retrySlotsBtn} onPress={() => void refetchSlots()}>
                  <Text style={themedStyles.headerTitle}>Retry</Text>
                </AppPressable>
              </View>
            ) : slotsForDate.length === 0 ? (
              <Text style={[styles.slotsEmptyText, themedStyles.headerStep]}>No time slots for this date.</Text>
            ) : (
              <View style={styles.timeGrid}>
                {chunkCells(slotsForDate, BOOKING_SLOT_GRID_COLUMNS).map((row, rowIdx) => (
                  <View key={`time-row-${rowIdx}`} style={styles.timeGridRow}>
                    {row.map((slot) => {
                      const isSelected = selectedTime === slot.label && slot.available;
                      return (
                        <AppPressable
                          key={slot.dateTimeIso}
                          disabled={!slot.available}
                          style={[
                            styles.timeCell,
                            themedStyles.timeCell,
                            isSelected && styles.timeCellSel,
                            isSelected && themedStyles.timeCellSel,
                            !slot.available && themedStyles.timeCellUnavailable,
                          ]}
                          onPress={() => setSelectedTime(slot.label)}
                        >
                          <Text style={[themedStyles.timeCellText, isSelected && styles.timeCellTextSel, isSelected && themedStyles.timeCellTextSel]}>
                            {slot.label}
                          </Text>
                        </AppPressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.panelFill}>
          {step === 0 ? (
            <BookingFlowPlacePanel
              fillContent
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                images: place.images,
              }}
              heroTopInset={Math.max(insets.top, 10)}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={() => navigation.goBack()}
              useMonotoneDarkBackground={useMonotoneDarkBackground}
            >
              <Text style={[styles.section, themedStyles.sectionText]}>Number of guests</Text>
              <View style={styles.guestRow}>
                <AppPressable style={[styles.guestBtn, themedStyles.guestButton]} onPress={() => setGuests(Math.max(BOOKING_FLOW_MIN_GUESTS, guests - 1))}>
                  <Text style={[styles.guestBtnText, themedStyles.guestButtonText]}>−</Text>
                </AppPressable>
                <Text style={[styles.guestCount, themedStyles.guestCountText]}>{guests}</Text>
                <AppPressable style={[styles.guestBtn, themedStyles.guestButton]} onPress={() => setGuests(Math.min(BOOKING_FLOW_MAX_GUESTS, guests + 1))}>
                  <Text style={[styles.guestBtnText, themedStyles.guestButtonText]}>+</Text>
                </AppPressable>
              </View>
            </BookingFlowPlacePanel>
          ) : null}

          {step === 2 ? (
            <BookingFlowPlacePanel
              fillContent
              place={{
                id: place.id,
                name: place.name,
                address: place.address,
                rating: place.rating,
                images: place.images,
              }}
              heroTopInset={Math.max(insets.top, 10)}
              isFavorite={isFavorite}
              onPressFavorite={onFavoritePress}
              onPressBack={() => setStep(step - 1)}
              useMonotoneDarkBackground={useMonotoneDarkBackground}
            >
              <Text style={[styles.section, themedStyles.sectionText]}>Confirm</Text>
              <Text style={themedStyles.confirmText}>
                {guests} guests · {selectedDate.toDateString()} {selectedTime}
              </Text>
            </BookingFlowPlacePanel>
          ) : null}
        </View>
      )}

      <View style={[styles.footer, themedStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step < BOOKING_FLOW_TOTAL_STEPS ? (
          <AppPressable
            style={styles.primary}
            onPress={() => {
              if (step === 0 && !isProfileComplete(profile)) {
                Alert.alert("Profile incomplete", "Please, fill out all your profile data before booking.");
                navigation.getParent()?.dispatch(
                  CommonActions.navigate({
                    name: "Profile",
                    params: { screen: "EditProfile" },
                  }),
                );
                return;
              }
              if (step === 1 && !selectedTime) {
                Alert.alert("Pick a time");
                return;
              }
              if (step === 1 && !selectedAvailableSlot) {
                Alert.alert("Pick an available time");
                return;
              }
              setStep(step + 1);
            }}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </AppPressable>
        ) : (
          <AppPressable
            style={[styles.primary, confirming && { opacity: 0.55 }]}
            disabled={confirming}
            accessibilityState={{ disabled: confirming }}
            onPress={() => void handleConfirm()}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Confirm booking</Text>
            )}
          </AppPressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  panelFill: { flex: 1 },
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
  timeGrid: { marginTop: 16, gap: 8, width: "100%", alignSelf: "stretch" },
  timeGridRow: { flexDirection: "row", gap: 8, width: "100%" },
  timeCell: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  timeCellSel: { backgroundColor: "#111" },
  timeCellTextSel: { color: "#fff", fontWeight: "600" },
  slotsLoading: { marginTop: 16 },
  slotsError: { marginTop: 16, gap: 8 },
  retrySlotsBtn: { alignSelf: "flex-start", paddingVertical: 8 },
  slotsEmptyText: { marginTop: 16 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#eee" },
  primary: primaryPressableStyle,
  primaryText: primaryPressableTextStyle,
});
