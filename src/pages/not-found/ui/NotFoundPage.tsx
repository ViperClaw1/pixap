import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileStackParamList } from "@/navigation/types";
import { navigateToHomeMain } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "NotFound">;

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          backgroundColor: colors.background,
        },
        title: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: colors.text },
        btn: {
          ...primaryPressableStyle,
          paddingHorizontal: 24,
        },
        btnText: primaryPressableTextStyle,
      }),
    [colors, insets.bottom, insets.top],
  );

  return (
    <View style={stylesThemed.root}>
      <Text style={stylesThemed.title}>{t("notFound.title")}</Text>
      <Pressable style={stylesThemed.btn} onPress={() => navigateToHomeMain(navigation)}>
        <Text style={stylesThemed.btnText}>{t("notFound.goHome")}</Text>
      </Pressable>
    </View>
  );
}
