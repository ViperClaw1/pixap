import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";

export function BookingWhatsAppBanner() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}>
      <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
      <Text style={[styles.text, { color: colors.text }]}>
        {t("bookingFlow.whatsappTooltip", {
          defaultValue: "Your booking goes to WhatsApp for venue confirmation.",
        })}
      </Text>
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
