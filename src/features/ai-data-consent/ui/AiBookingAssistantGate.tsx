import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAiDataConsent } from "../model/useAiDataConsent";

type Props = {
  children: ReactNode;
};

export function AiBookingAssistantGate({ children }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { status, isGranted, isDeclined, grant } = useAiDataConsent();

  if (status === "loading" || status === "pending") return null;

  if (isDeclined) {
    return (
      <View
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{t("aiConsent.message")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void grant()}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: 14 }}>{t("aiConsent.allow")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!isGranted) return null;

  return <>{children}</>;
}
