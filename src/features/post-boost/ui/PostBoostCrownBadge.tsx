import { StyleSheet, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

const CROWN_COLOR = "#F5B301";
const BADGE_BG = "rgba(0,0,0,0.45)";

export function PostBoostCrownBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: BADGE_BG }]} accessibilityLabel="Boosted post">
      <FontAwesome6 name="crown" size={16} color={CROWN_COLOR} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
