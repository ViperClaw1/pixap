import { AppPressable } from "@/shared/ui/app-pressable";
import type { Dispatch, SetStateAction } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { PixAIPlace, PixAISlot } from "@/entities/pixai";
import { chunkCells, WEEKDAY_LABELS, type CalendarCell } from "@/shared/lib/bookingCalendar";
import { findBookingSlotForTime, minutesFromDate, resolveBookingTimeUnavailableReason, RESTAURANT_BOOKING_TIME_WINDOWS } from "@/entities/booking/lib/bookingSlots";
import { BookingTimePicker } from "@/shared/ui/booking-time-picker";
import type { AIBookingStyles } from "./aiBookingStyles";

type Props = {
  styles: AIBookingStyles;
  selectedPlace: PixAIPlace;
  visibleCalendarMonth: Date;
  setVisibleCalendarMonth: Dispatch<SetStateAction<Date>>;
  canGoPrevMonth: boolean;
  canGoNextMonth: boolean;
  calendarCells: CalendarCell[];
  todayYmd: string;
  bookingDateYmd: string | null;
  setBookingDateYmd: (ymd: string | null) => void;
  selectedBookingTime: Date | null;
  onSelectedBookingTimeChange: (date: Date) => void;
  slotsForDate: PixAISlot[];
  slotsFetching: boolean;
  slotsError: boolean;
  refetchSlots: () => void;
  cartReservedSlotTimes: Set<number>;
  isRestaurant: boolean;
  use12h: boolean;
};

export function AIBookingSlotPicker({
  styles: s,
  selectedPlace,
  visibleCalendarMonth,
  setVisibleCalendarMonth,
  canGoPrevMonth,
  canGoNextMonth,
  calendarCells,
  todayYmd,
  bookingDateYmd,
  setBookingDateYmd,
  selectedBookingTime,
  onSelectedBookingTimeChange,
  slotsForDate,
  slotsFetching,
  slotsError,
  refetchSlots,
  cartReservedSlotTimes,
  isRestaurant,
  use12h,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();

  const resolvedSlot =
    selectedBookingTime && bookingDateYmd
      ? findBookingSlotForTime(slotsForDate, minutesFromDate(selectedBookingTime))
      : null;
  const inCart =
    resolvedSlot != null && cartReservedSlotTimes.has(new Date(resolvedSlot.dateTimeIso).getTime());
  const timeUnavailableReason =
    selectedBookingTime && bookingDateYmd
      ? resolveBookingTimeUnavailableReason({
          slot: resolvedSlot,
          dateYmd: bookingDateYmd,
          totalMinutes: minutesFromDate(selectedBookingTime),
          reservedInCart: inCart,
        })
      : null;

  return (
    <View style={s.semanticSection}>
      <Text style={s.label}>{t("aiBooking.step2Title")}</Text>
      <Text style={s.calendarHint} numberOfLines={2}>
        {t("aiBooking.calendarHint", { name: selectedPlace.name })}
      </Text>
      <View style={s.calendarPanel}>
        <View style={s.calendarNav}>
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel={t("bookingCommon.previousMonth")}
            disabled={!canGoPrevMonth}
            onPress={() =>
              setVisibleCalendarMonth((prev) => {
                const y = prev.getFullYear();
                const m = prev.getMonth();
                return new Date(y, m - 1, 1);
              })
            }
            style={[s.calendarNavBtn, !canGoPrevMonth && s.calendarNavBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </AppPressable>
          <Text style={s.calendarMonthTitle}>
            {visibleCalendarMonth.toLocaleDateString(i18n.language, { month: "long", year: "numeric" })}
          </Text>
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel={t("bookingCommon.nextMonth")}
            disabled={!canGoNextMonth}
            onPress={() =>
              setVisibleCalendarMonth((prev) => {
                const y = prev.getFullYear();
                const m = prev.getMonth();
                return new Date(y, m + 1, 1);
              })
            }
            style={[s.calendarNavBtn, !canGoNextMonth && s.calendarNavBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </AppPressable>
        </View>
        <View style={s.calendarDowRow}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={s.calendarDowCell}>
              {label}
            </Text>
          ))}
        </View>
        {chunkCells(calendarCells, 7).map((row, rowIdx) => (
          <View key={`w-${rowIdx}`} style={s.calendarWeekRow}>
            {row.map((cell, colIdx) => {
              if (cell.kind === "pad") {
                return <View key={`p-${rowIdx}-${colIdx}`} style={s.calendarCell} />;
              }
              const { ymd, day } = cell;
              const isSelected = bookingDateYmd === ymd;
              const isToday = ymd === todayYmd;
              const isPast = ymd < todayYmd;
              return (
                <View key={ymd} style={s.calendarCell}>
                  <AppPressable
                    accessibilityRole="button"
                    accessibilityLabel={`${ymd}`}
                    disabled={isPast}
                    onPress={() => {
                      setBookingDateYmd(ymd);
                    }}
                    style={[
                      s.calendarCellDayInner,
                      isToday && s.calendarCellToday,
                      isSelected && s.calendarCellSelected,
                      isPast && s.calendarCellPast,
                    ]}
                  >
                    <Text style={s.calendarCellDayText}>{day}</Text>
                  </AppPressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {!bookingDateYmd ? (
        <Text style={s.calendarHint}>{t("aiBooking.selectDateForSlots")}</Text>
      ) : slotsFetching ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : slotsError ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={s.helperText}>{t("aiBooking.couldNotLoadSlots")}</Text>
          <AppPressable style={s.secondaryBtn} onPress={() => void refetchSlots()}>
            <Text style={s.secondaryBtnText}>{t("bookingCommon.retry")}</Text>
          </AppPressable>
        </View>
      ) : slotsForDate.length === 0 ? (
        <Text style={s.calendarHint}>{t("aiBooking.noTimeSlotsForDate")}</Text>
      ) : (
        <BookingTimePicker
          dateYmd={bookingDateYmd}
          value={selectedBookingTime}
          onChange={onSelectedBookingTimeChange}
          unavailableReason={timeUnavailableReason}
          style={{ marginTop: 16 }}
          windows={isRestaurant ? RESTAURANT_BOOKING_TIME_WINDOWS : undefined}
          use12h={use12h}
        />
      )}
    </View>
  );
}
