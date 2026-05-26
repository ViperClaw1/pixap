import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const BOOST_STAR_COLOR = "#F5B301";
const BADGE_BG = "rgba(245, 179, 1, 0.12)";
const BADGE_BORDER = "rgba(245, 179, 1, 0.35)";

export function PostBoostCrownBadge() {
  const { t } = useTranslation();

  return (
    <View
      style={[styles.badge, { backgroundColor: BADGE_BG, borderColor: BADGE_BORDER }]}
      accessibilityLabel={t("postBoost.topBadgeAccessibility")}
    >
      <Ionicons name="star" size={12} color={BOOST_STAR_COLOR} />
      <Text style={[styles.label, { color: BOOST_STAR_COLOR }]}>{t("postBoost.topLabel")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
