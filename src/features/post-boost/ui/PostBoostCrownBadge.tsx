import { StyleSheet, View } from "react-native";
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
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    width: 24,
    height: 24,
    flexShrink: 0,
  },
});
