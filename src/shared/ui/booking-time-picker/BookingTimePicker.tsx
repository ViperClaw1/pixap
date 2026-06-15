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
  clampBookingPickerDate,
  defaultBookingDateTime,
  formatBookingTimeLabel,
  minutesFromDate,
} from "@/entities/booking/lib/bookingSlots";

type Props = {
  dateYmd: string;
  value: Date | null;
  onChange: (date: Date) => void;
  unavailable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BookingTimePicker({ dateYmd, value, onChange, unavailable = false, style }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const [pickerWidth, setPickerWidth] = useState(0);

  const pickerValue = value ?? defaultBookingDateTime(dateYmd);
  const displayLabel = formatBookingTimeLabel(minutesFromDate(pickerValue));

  useEffect(() => {
    if (value != null) return;
    onChange(defaultBookingDateTime(dateYmd));
  }, [dateYmd, value, onChange]);

  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    onChange(clampBookingPickerDate(dateYmd, selected));
  };

  const onPickerShellLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== pickerWidth) {
      setPickerWidth(nextWidth);
    }
  };

  return (
    <View style={[styles.root, style]}>
      <Text style={[styles.title, { color: colors.text }]}>{t("bookingCommon.selectBookingTime")}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t("bookingCommon.bookingTimeWindowHint")}</Text>
      <View
        onLayout={onPickerShellLayout}
        style={[
          styles.pickerShell,
          {
            borderColor: unavailable ? colors.danger : colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        {pickerWidth > 0 ? (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={pickerValue}
            onChange={onPickerChange}
            minuteInterval={BOOKING_SLOT_STEP_MINUTES}
            themeVariant={isDark ? "dark" : "light"}
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
      {unavailable ? (
        <Text style={[styles.unavailable, { color: colors.danger }]}>
          {t("bookingCommon.selectedTimeUnavailable")}
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
    ...(Platform.OS === "ios" ? { height: 216 } : {}),
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
