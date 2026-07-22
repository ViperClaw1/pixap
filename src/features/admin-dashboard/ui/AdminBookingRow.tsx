import { View, Text, StyleSheet, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AppPressable } from "@/shared/ui/app-pressable";
import { localizeWaStatusLine } from "@/entities/cart";
import {
  buildAvailabilityMessage,
  openWhatsAppAvailability,
  resolveWhatsAppPhone,
  serviceCartContextLines,
} from "@/entities/shopping";
import { openPhoneDialer } from "@/shared/lib/openPhoneDialer";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import type { AdminWhatsappBookingRow } from "@/entities/admin-analytics";

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type Props = {
  booking: AdminWhatsappBookingRow;
};

export function AdminBookingRow({ booking }: Props) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const lines = Array.isArray(booking.wa_status_lines) ? (booking.wa_status_lines as unknown[]) : [];
  const lastLine = lines.length ? localizeWaStatusLine(String(lines[lines.length - 1]), t) : null;

  const handleCall = async () => {
    if (!booking.venue_phone) {
      Alert.alert(t("adminDashboard.whatsapp.callUnavailableTitle"), t("adminDashboard.whatsapp.callUnavailableBody"));
      return;
    }
    const result = await openPhoneDialer(booking.venue_phone);
    if (result !== "ok") {
      Alert.alert(t("adminDashboard.whatsapp.callUnavailableTitle"), t("adminDashboard.whatsapp.callUnavailableBody"));
    }
  };

  const handleWhatsApp = () => {
    const phone = resolveWhatsAppPhone(booking.venue_contact_whatsapp);
    const message = buildAvailabilityMessage("restaurant", {
      businessName: booking.venue_name,
      extraLines: serviceCartContextLines({
        dateTimeLabel: formatDateTime(booking.date_time),
        persons: booking.persons,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
      }),
    });
    void openWhatsAppAvailability(phone, message);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.venue} numberOfLines={1}>
          {booking.venue_name}
        </Text>
        <Text style={styles.status}>{booking.status}</Text>
      </View>
      <Text style={styles.meta}>
        {formatDateTime(booking.date_time)} · {booking.persons ?? "—"} {t("adminDashboard.whatsapp.guests")}
      </Text>
      <Text style={styles.meta}>
        {booking.customer_name ?? "—"} · {booking.customer_phone ?? "—"}
      </Text>
      {lastLine ? <Text style={styles.statusLine}>{lastLine}</Text> : null}

      <View style={styles.actions}>
        <AppPressable style={[styles.actionBtn, styles.callBtn]} onPress={handleCall}>
          <Ionicons name="call-outline" size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{t("adminDashboard.whatsapp.callBtn")}</Text>
        </AppPressable>
        <AppPressable style={[styles.actionBtn, styles.waBtn]} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{t("adminDashboard.whatsapp.waBtn")}</Text>
        </AppPressable>
      </View>
    </View>
  );
}

function createStyles({
  colors,
}: {
  colors: { text: string; textMuted: string; primary: string; border: string };
}) {
  return StyleSheet.create({
    row: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    venue: { fontWeight: "700", color: colors.text, flex: 1 },
    status: { fontSize: 12, color: colors.textMuted, textTransform: "uppercase" },
    meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statusLine: { fontSize: 12, color: colors.primary, marginTop: 4 },
    actions: { flexDirection: "row", gap: 8, marginTop: 8 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    callBtn: { backgroundColor: "#2563eb" },
    waBtn: { backgroundColor: "#16a34a" },
    actionBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  });
}
