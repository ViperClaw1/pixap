import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { localizeWaStatusLine } from "@/entities/cart";
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
  });
}
