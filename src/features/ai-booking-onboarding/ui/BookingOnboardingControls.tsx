import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingOnboardingPhase } from "../model/types";

type Props = {
  phase: BookingOnboardingPhase;
  nearMeLabel: string;
  allPlacesInMyCityLabel: string;
  searchPlacesBusy: boolean;
  onOpenCityPicker: () => void;
  onOpenCategoryPicker: () => void;
  onScopeSelected: (scope: "nearby" | "city") => void;
};

export function BookingOnboardingControls({
  phase,
  nearMeLabel,
  allPlacesInMyCityLabel,
  searchPlacesBusy,
  onOpenCityPicker,
  onOpenCategoryPicker,
  onScopeSelected,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  if (phase === "gemini" || phase === "greeting" || phase === "assistant_typing" || phase === "search_results") {
    return null;
  }

  const showCityPicker = phase === "await_city";
  const showCategoryPicker = phase === "await_category";
  const showScopeChips = phase === "await_scope";

  return (
    <View style={{ gap: 8 }}>
      {showCityPicker ? (
        <AppPressable
          accessibilityRole="button"
          onPress={onOpenCityPicker}
          style={{
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>{t("bookingCommon.selectCity")}</Text>
        </AppPressable>
      ) : null}

      {showCategoryPicker ? (
        <AppPressable
          accessibilityRole="button"
          onPress={onOpenCategoryPicker}
          style={{
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>{t("bookingCommon.selectServiceOrTable")}</Text>
        </AppPressable>
      ) : null}

      {showScopeChips ? (
        <View style={{ gap: 8, alignSelf: "stretch" }}>
          <AppPressable
            disabled={searchPlacesBusy}
            onPress={() => onScopeSelected("nearby")}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.background,
              opacity: searchPlacesBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>{nearMeLabel}</Text>
          </AppPressable>
          <AppPressable
            disabled={searchPlacesBusy}
            onPress={() => onScopeSelected("city")}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.background,
              opacity: searchPlacesBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>{allPlacesInMyCityLabel}</Text>
          </AppPressable>
        </View>
      ) : null}

      {phase === "searching" || searchPlacesBusy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("aiBooking.searching")}</Text>
        </View>
      ) : null}
    </View>
  );
}
