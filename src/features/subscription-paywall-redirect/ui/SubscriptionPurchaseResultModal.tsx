import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AppPressable } from "@/shared/ui/app-pressable";

type Props = {
  visible: boolean;
  success: boolean;
  errorMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
};

export function SubscriptionPurchaseResultModal({
  visible,
  success,
  errorMessage,
  onDismiss,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Ionicons
            name={success ? "checkmark-circle" : "alert-circle"}
            size={48}
            color={success ? "#22c55e" : colors.danger}
          />
          <Text style={[styles.title, { color: colors.text }]}>
            {success
              ? t("subscriptionPaywall.purchaseSuccessTitle")
              : t("subscriptionPaywall.purchaseErrorTitle")}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {success
              ? t("subscriptionPaywall.purchaseSuccessBody")
              : (errorMessage ?? t("subscriptionPaywall.purchaseErrorBody"))}
          </Text>
          <AppPressable
            accessibilityRole="button"
            style={[
              styles.primaryAction,
              { backgroundColor: success ? colors.primary : colors.background },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.primaryActionText, { color: success ? colors.onPrimary : colors.text }]}>
              {success ? t("subscriptionPaywall.purchaseSuccessCta") : t("common.close")}
            </Text>
          </AppPressable>
          {!success && onRetry ? (
            <AppPressable accessibilityRole="button" onPress={onRetry} style={styles.retryAction}>
              <Text style={[styles.retryActionText, { color: colors.primary }]}>
                {t("subscriptionPaywall.restore")}
              </Text>
            </AppPressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryAction: {
    width: "100%",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 4,
    padding: 14,
  },
  primaryActionText: {
    fontWeight: "600",
  },
  retryAction: {
    padding: 8,
  },
  retryActionText: {
    fontWeight: "500",
  },
});
