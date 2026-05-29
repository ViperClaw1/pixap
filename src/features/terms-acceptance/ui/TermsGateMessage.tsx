import { Linking, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAppPopupStyles } from "@/shared/ui/app-popup";
import { COMMUNITY_GUIDELINES_URL, TERMS_URL } from "@/shared/lib/legalUrls";

export function TermsGateMessage() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useAppPopupStyles();

  return (
    <Text style={styles.message}>
      {t("legal.termsGateMessagePrefix")}{" "}
      <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(TERMS_URL)}>
        {t("legal.terms")}
      </Text>{" "}
      {t("legal.acceptTermsAnd")}{" "}
      <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(COMMUNITY_GUIDELINES_URL)}>
        {t("legal.communityGuidelines")}
      </Text>
      . {t("legal.termsGateMessageSuffix")}
    </Text>
  );
}
