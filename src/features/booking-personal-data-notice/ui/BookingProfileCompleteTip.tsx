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
  style?: object;
};

/** Soft tip at the bottom of guest forms when profile name/phone are incomplete. */
export function BookingProfileCompleteTip({ visible, navigation, style }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const themed = useMemo(() => bookingPersonalDataNoticeThemeStyles(colors, "tip"), [colors]);

  if (!visible) return null;

  return (
    <View style={[staticStyles.root, themed.root, style]}>
      <Ionicons name="alert-circle-outline" size={22} color={colors.warningBorder} />
      <View style={staticStyles.body}>
        <Text style={[staticStyles.message, themed.message]}>
          {t("bookingCommon.profileCompleteTipMessage")}
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
