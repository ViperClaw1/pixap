import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type Props = {
  progress: number;
};

export function OnboardingProgressBar({ progress }: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={[styles.track, { backgroundColor: colors.border }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});
