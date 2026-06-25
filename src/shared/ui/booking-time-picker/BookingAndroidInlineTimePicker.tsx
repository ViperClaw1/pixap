import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import {
  bookingDateTimeFromYmd,
  defaultBookingDateTime,
  getAllowedBookingHours,
  getAllowedBookingMinutesForHour,
  minutesFromDate,
  splitAllowedBookingTime,
  type BookingTimeWindows,
} from "@/entities/booking/lib/bookingSlots";

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const WHEEL_PAD_ROWS = Math.floor(WHEEL_VISIBLE_ROWS / 2);

type WheelProps = {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  format: (value: number) => string;
  paddingMode?: WheelPaddingMode;
};

type WheelItem = {
  key: string;
  value: number;
};

type WheelPaddingMode = "edge" | "cyclic";

function buildPaddedWheelItems(values: number[], mode: WheelPaddingMode): WheelItem[] {
  if (values.length === 0) return [];
  const items: WheelItem[] = [];
  const len = values.length;

  for (let i = 0; i < WHEEL_PAD_ROWS; i += 1) {
    const value =
      mode === "cyclic" && len > 0
        ? values[(len - WHEEL_PAD_ROWS + i + len) % len]
        : values[0];
    items.push({ key: `pad-start-${i}`, value });
  }

  values.forEach((value, index) => {
    items.push({ key: `value-${index}`, value });
  });

  for (let i = 0; i < WHEEL_PAD_ROWS; i += 1) {
    const value = mode === "cyclic" && len > 0 ? values[i % len] : values[len - 1];
    items.push({ key: `pad-end-${i}`, value });
  }

  return items;
}

function TimeWheel({ values, selected, onSelect, format, paddingMode = "edge" }: WheelProps) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, values.indexOf(selected));
  const wheelItems = useMemo(() => buildPaddedWheelItems(values, paddingMode), [paddingMode, values]);
  const selectedItemIndex = WHEEL_PAD_ROWS + selectedIndex;
  const cyclic = paddingMode === "cyclic";
  const scrollOffsetForIndex = (index: number) => index * WHEEL_ITEM_HEIGHT;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      y: scrollOffsetForIndex(selectedIndex),
      animated: false,
    });
  }, [selectedIndex, values]);

  const settleSelection = useCallback(
    (offsetY: number) => {
      let valueIndex = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
      if (cyclic && values.length > 0) {
        valueIndex = ((valueIndex % values.length) + values.length) % values.length;
      } else {
        valueIndex = Math.max(0, Math.min(values.length - 1, valueIndex));
      }
      const next = values[valueIndex];
      if (next !== selected) {
        onSelect(next);
      } else if (cyclic) {
        scrollRef.current?.scrollTo({
          y: scrollOffsetForIndex(valueIndex),
          animated: true,
        });
      }
    },
    [cyclic, onSelect, selected, values],
  );

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleSelection(event.nativeEvent.contentOffset.y);
    },
    [settleSelection],
  );

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
      >
        {wheelItems.map((item, index) => {
          const isSelected = index === selectedItemIndex;
          return (
            <View key={item.key} style={styles.wheelItem}>
              <Text
                style={[
                  styles.wheelItemText,
                  { color: isSelected ? colors.text : colors.textMuted },
                  isSelected && styles.wheelItemTextSelected,
                ]}
              >
                {format(item.value)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

type Props = {
  dateYmd: string;
  value: Date | null;
  onChange: (date: Date) => void;
  windows?: BookingTimeWindows;
  use12h?: boolean;
};

export function BookingAndroidInlineTimePicker({ dateYmd, value, onChange, windows, use12h = false }: Props) {
  const { colors } = useAppTheme();
  const pickerValue = value ?? defaultBookingDateTime(dateYmd);
  const { hour, minute } = splitAllowedBookingTime(minutesFromDate(pickerValue), windows);
  const allowedHours = useMemo(() => getAllowedBookingHours(windows), [windows]);
  const allowedMinutes = useMemo(() => getAllowedBookingMinutesForHour(hour, windows), [hour, windows]);
  const safeMinute = allowedMinutes.includes(minute) ? minute : allowedMinutes[0] ?? 0;

  const emitTime = useCallback(
    (nextHour: number, nextMinute: number) => {
      onChange(bookingDateTimeFromYmd(dateYmd, nextHour * 60 + nextMinute));
    },
    [dateYmd, onChange],
  );

  const onHourSelect = useCallback(
    (nextHour: number) => {
      const minutesForHour = getAllowedBookingMinutesForHour(nextHour);
      const nextMinute = minutesForHour.includes(safeMinute) ? safeMinute : minutesForHour[0] ?? 0;
      emitTime(nextHour, nextMinute);
    },
    [emitTime, safeMinute],
  );

  const onMinuteSelect = useCallback(
    (nextMinute: number) => {
      emitTime(hour, nextMinute);
    },
    [emitTime, hour],
  );

  return (
    <View style={[styles.wheelsRow, { backgroundColor: colors.card }]}>
      <View
        pointerEvents="none"
        style={[styles.selectionBand, { borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <TimeWheel
        values={allowedHours}
        selected={hour}
        onSelect={onHourSelect}
        format={use12h
          ? (h) => `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`
          : (h) => String(h).padStart(2, "0")}
      />
      <Text style={[styles.colon, { color: colors.text }]}>:</Text>
      <TimeWheel
        values={allowedMinutes}
        selected={safeMinute}
        onSelect={onMinuteSelect}
        format={(m) => String(m).padStart(2, "0")}
        paddingMode="cyclic"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: WHEEL_HEIGHT,
    position: "relative",
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
    maxWidth: 88,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemText: {
    fontSize: 20,
  },
  wheelItemTextSelected: {
    fontSize: 22,
    fontWeight: "700",
  },
  colon: {
    fontSize: 22,
    fontWeight: "700",
    marginHorizontal: 4,
    marginBottom: 2,
  },
  selectionBand: {
    position: "absolute",
    left: 12,
    right: 12,
    top: WHEEL_PAD_ROWS * WHEEL_ITEM_HEIGHT,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    opacity: 0.9,
  },
});
