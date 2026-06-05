import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBackground: string;
  label: string;
};

export function PaywallPlanFeatureRow({ icon, iconColor, iconBackground, label }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
