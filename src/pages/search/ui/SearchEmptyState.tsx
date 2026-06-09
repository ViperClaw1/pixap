import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ctaGradientColors } from "@/shared/theme/gradients";

type Props = {
  onTryVibeMatch: () => void;
  message?: string;
};

export function SearchEmptyState({ onTryVibeMatch, message }: Props) {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();

  return (
    <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 12 }}>
      <Text style={{ fontSize: 56 }}>🗺️</Text>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>
        {message ?? t("search.noMatchingPlaces")}
      </Text>
      <Text style={{ fontSize: 14, textAlign: "center", opacity: 0.7 }}>
        {t("search.emptyHint", { defaultValue: "Let PixAI plan your evening instead." })}
      </Text>
      <AppPressable onPress={onTryVibeMatch} accessibilityRole="button" style={{ marginTop: 8, borderRadius: 12, overflow: "hidden" }}>
        <LinearGradient
          colors={[...ctaGradientColors(isDark)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingHorizontal: 22, paddingVertical: 14 }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 15 }}>
            {t("search.tryVibeMatch", { defaultValue: "Try Vibe Match" })}
          </Text>
        </LinearGradient>
      </AppPressable>
    </View>
  );
}
