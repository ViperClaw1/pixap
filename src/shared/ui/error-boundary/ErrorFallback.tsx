import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { SHARED_PRESSABLE_HEIGHT, SHARED_PRESSABLE_RADIUS } from "@/shared/theme/primaryPressable";
import type { ErrorBoundaryFallbackProps } from "./ErrorBoundary";

type ErrorFallbackProps = ErrorBoundaryFallbackProps & {
  titleKey: string;
  descriptionKey: string;
};

export function ErrorFallback({ error, resetError, titleKey, descriptionKey }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{t(titleKey)}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{t(descriptionKey)}</Text>
      {__DEV__ ? (
        <Text style={[styles.errorDetail, { color: colors.textMuted }]} numberOfLines={4}>
          {error.message}
        </Text>
      ) : null}
      <Pressable
        style={[styles.btn, { backgroundColor: colors.accent }]}
        onPress={resetError}
        accessibilityRole="button"
      >
        <Text style={[styles.btnText, { color: colors.onAccent }]}>{t("errorBoundary.retry")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  errorDetail: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    width: "100%",
  },
  btn: {
    minHeight: SHARED_PRESSABLE_HEIGHT,
    borderRadius: SHARED_PRESSABLE_RADIUS,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
