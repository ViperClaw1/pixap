import { AppPressable } from "@/shared/ui/app-pressable";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { navigateToEditProfile } from "@/app/navigation/navigationHelpers";
import {
  bookingPersonalDataNoticeStaticStyles as staticStyles,
  bookingPersonalDataNoticeThemeStyles,
} from "./bookingPersonalDataNoticeStyles";

type Props = {
  visible: boolean;
  navigation: NavigationProp<ParamListBase>;
  /** Required blocks booking in vibe match; info is advisory on other flows. */
  variant?: "info" | "required";
  style?: object;
};

export function BookingPersonalDataNotice({
  visible,
  navigation,
  variant = "info",
  style,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const themed = useMemo(
    () => bookingPersonalDataNoticeThemeStyles(colors, variant),
    [colors, variant],
  );

  if (!visible) return null;

  const iconName = variant === "required" ? "alert-circle-outline" : "information-circle-outline";
  const iconColor = variant === "required" ? colors.warningBorder : colors.primary;

  return (
    <View style={[staticStyles.root, themed.root, style]}>
      <Ionicons name={iconName} size={22} color={iconColor} />
      <View style={staticStyles.body}>
        <Text style={[staticStyles.message, themed.message]}>
          {t("bookingCommon.personalDataNoticeMessage")}
        </Text>
        <AppPressable
          accessibilityRole="button"
          style={[staticStyles.cta, themed.cta]}
          onPress={() => navigateToEditProfile(navigation)}
        >
          <Text style={[staticStyles.ctaText, themed.ctaText]}>
            {t("bookingCommon.personalDataNoticeCta")}
          </Text>
        </AppPressable>
      </View>
    </View>
  );
}
