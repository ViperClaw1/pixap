import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { navigateToHomeMain } from "@/app/navigation/navigationHelpers";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { notFoundStaticStyles, notFoundThemeStyles } from "./notFoundStyles";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "NotFound">;

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const themed = useThemeStyles(
    ({ colors: c }) => notFoundThemeStyles(c, insets.top, insets.bottom),
    [insets.top, insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(notFoundStaticStyles, themed),
    [themed],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("notFound.title")}</Text>
      <Pressable style={styles.btn} onPress={() => navigateToHomeMain(navigation)}>
        <Text style={styles.btnText}>{t("notFound.goHome")}</Text>
      </Pressable>
    </View>
  );
}
