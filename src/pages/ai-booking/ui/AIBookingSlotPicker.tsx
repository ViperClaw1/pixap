import type { Dispatch, SetStateAction } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { PixAIPlace, PixAISlot } from "@/entities/pixai";
import { chunkCells, WEEKDAY_LABELS, type CalendarCell } from "@/shared/lib/bookingCalendar";
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
  setSelectedSlot: (slot: PixAISlot | null) => void;
  slotsForDate: PixAISlot[];
  slotsFetching: boolean;
  slotsError: boolean;
  refetchSlots: () => void;
  cartReservedSlotTimes: Set<number>;
  selectedSlot: PixAISlot | null;
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
  setSelectedSlot,
  slotsForDate,
  slotsFetching,
  slotsError,
  refetchSlots,
  cartReservedSlotTimes,
  selectedSlot,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={s.semanticSection}>
      <Text style={s.label}>Step 5. Available slots</Text>
      <Text style={s.calendarHint} numberOfLines={2}>
        Pick a date for {selectedPlace.name}, then choose a time.
      </Text>
      <View style={s.calendarPanel}>
        <View style={s.calendarNav}>
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
            style={[s.calendarNavBtn, !canGoPrevMonth && s.calendarNavBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={s.calendarMonthTitle}>
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
            style={[s.calendarNavBtn, !canGoNextMonth && s.calendarNavBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${ymd}`}
                    disabled={isPast}
                    onPress={() => {
                      setBookingDateYmd(ymd);
                      setSelectedSlot(null);
                    }}
                    style={[
                      s.calendarCellDayInner,
                      isToday && s.calendarCellToday,
                      isSelected && s.calendarCellSelected,
                      isPast && s.calendarCellPast,
                    ]}
                  >
                    <Text style={s.calendarCellDayText}>{day}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {!bookingDateYmd ? (
        <Text style={s.calendarHint}>Select a date to load time slots.</Text>
      ) : slotsFetching ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : slotsError ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={s.helperText}>Could not load slots.</Text>
          <Pressable style={s.secondaryBtn} onPress={() => void refetchSlots()}>
            <Text style={s.secondaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : slotsForDate.length === 0 ? (
        <Text style={s.calendarHint}>No time slots for this date.</Text>
      ) : (
        <View style={[s.slotGrid, { marginTop: 10 }]}>
          {slotsForDate.map((slot) => {
            const inCart = cartReservedSlotTimes.has(new Date(slot.dateTimeIso).getTime());
            const disabled = !slot.available || inCart;
            return (
              <Pressable
                disabled={disabled}
                key={slot.dateTimeIso}
                onPress={() => setSelectedSlot(slot)}
                style={[
                  s.slotChip,
                  selectedSlot?.dateTimeIso === slot.dateTimeIso && s.slotChipSelected,
                  disabled && s.slotChipUnavailable,
                ]}
              >
                <Text style={s.slotText}>{slot.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
