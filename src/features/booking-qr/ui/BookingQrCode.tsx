import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { WaBookingQrPayload } from "../model/types";
import { buildBookingQrValue } from "../lib/parseWaQrPayload";

type Props = {
  payload: WaBookingQrPayload;
};

function BookingQrCodeInner({ payload }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const value = buildBookingQrValue(payload);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{t("bookings.qrTitle")}</Text>
      <View style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <QRCode value={value} size={148} backgroundColor={colors.surface} color={colors.text} />
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
        {payload.place_name} · {payload.booking_date} {payload.booking_slot}
      </Text>
      {!payload.is_free && payload.price ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{payload.price}</Text>
      ) : payload.is_free ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t("bookings.qrFree")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    gap: 6,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  qrBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  meta: {
    fontSize: 12,
  },
});

export const BookingQrCode = memo(BookingQrCodeInner);
