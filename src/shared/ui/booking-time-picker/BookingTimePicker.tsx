import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import {
  BOOKING_SLOT_STEP_MINUTES,
  bookingDateTimeFromYmd,
  clampBookingPickerDate,
  defaultBookingDateTime,
  formatBookingTimeLabel,
  formatBookingTimeLabelAmPm,
  isBookingTimeInRestrictedWindow,
  minutesFromDate,
  snapToBookingTimeGrid,
  type BookingTimeUnavailableReason,
  type BookingTimeWindows,
} from "@/entities/booking/lib/bookingSlots";
import { BookingAndroidInlineTimePicker } from "./BookingAndroidInlineTimePicker";

type Props = {
  dateYmd: string;
  value: Date | null;
  onChange: (date: Date) => void;
  unavailableReason?: BookingTimeUnavailableReason | null;
  style?: StyleProp<ViewStyle>;
  windows?: BookingTimeWindows;
  use12h?: boolean;
};

const UNAVAILABLE_MESSAGE_KEYS: Record<BookingTimeUnavailableReason, string> = {
  past: "bookingCommon.selectedTimeInPast",
  busy: "bookingCommon.selectedTimeSlotTaken",
  restricted: "bookingCommon.selectedTimeRestricted",
};

export function BookingTimePicker({
  dateYmd,
  value,
  onChange,
  unavailableReason = null,
  style,
  windows,
  use12h = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const [pickerWidth, setPickerWidth] = useState(0);

  const pickerValue = value ?? defaultBookingDateTime(dateYmd);
  const displayLabel = use12h
    ? formatBookingTimeLabelAmPm(minutesFromDate(pickerValue))
    : formatBookingTimeLabel(minutesFromDate(pickerValue));

  useEffect(() => {
    if (Platform.OS !== "ios" || value != null) return;
    onChange(defaultBookingDateTime(dateYmd));
  }, [dateYmd, value, onChange]);

  const onPickerShellLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== pickerWidth) {
      setPickerWidth(nextWidth);
    }
  };

  const onIosPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    if (!windows) {
      const snappedMinutes = snapToBookingTimeGrid(minutesFromDate(selected));
      if (isBookingTimeInRestrictedWindow(snappedMinutes)) {
        onChange(bookingDateTimeFromYmd(dateYmd, snappedMinutes));
        return;
      }
    }
    onChange(clampBookingPickerDate(dateYmd, selected, windows));
  };

  return (
    <View style={[styles.root, style]}>
      <Text style={[styles.title, { color: colors.text }]}>{t("bookingCommon.selectBookingTime")}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t("bookingCommon.bookingTimeWindowHint")}</Text>
      <View
        onLayout={Platform.OS === "ios" ? onPickerShellLayout : undefined}
        style={[
          styles.pickerShell,
          {
            borderColor: unavailableReason ? colors.danger : colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        {Platform.OS === "android" ? (
          <BookingAndroidInlineTimePicker dateYmd={dateYmd} value={value} onChange={onChange} windows={windows} use12h={use12h} />
        ) : pickerWidth > 0 ? (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={pickerValue}
            onChange={onIosPickerChange}
            minuteInterval={BOOKING_SLOT_STEP_MINUTES}
            themeVariant={isDark ? "dark" : "light"}
            locale={use12h ? "en_US" : "en_GB"}
            style={[
              styles.picker,
              {
                width: pickerWidth,
                backgroundColor: colors.card,
              },
            ]}
          />
        ) : null}
      </View>
      <Text style={[styles.selectedLabel, { color: colors.text }]}>
        {t("bookingCommon.selectedBookingTime", { time: displayLabel })}
      </Text>
      {unavailableReason ? (
        <Text style={[styles.unavailable, { color: colors.danger }]}>
          {t(UNAVAILABLE_MESSAGE_KEYS[unavailableReason])}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignSelf: "stretch",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    marginBottom: 10,
  },
  pickerShell: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  picker: {
    alignSelf: "center",
    height: 216,
  },
  selectedLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  unavailable: {
    fontSize: 13,
    marginTop: 6,
  },
});
