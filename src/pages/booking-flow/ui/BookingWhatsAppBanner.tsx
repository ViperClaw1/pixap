import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingChannel } from "@/shared/lib/booking/bookingChannel";

type Props = { channel: BookingChannel };

export function BookingWhatsAppBanner({ channel }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const icon =
    channel === "whatsapp"
      ? ("logo-whatsapp" as const)
      : channel === "voice"
        ? ("call-outline" as const)
        : channel === "email"
          ? ("mail-outline" as const)
          : ("information-circle-outline" as const);

  const iconColor = channel === "whatsapp" ? "#25D366" : colors.primary;

  const text =
    channel === "whatsapp"
      ? t("bookingFlow.confirmChannelWhatsapp")
      : channel === "voice"
        ? t("bookingFlow.confirmChannelVoice")
        : channel === "email"
          ? t("bookingFlow.confirmChannelEmail")
          : t("bookingFlow.confirmChannelUnknown");

  return (
    <View style={[styles.wrap, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
