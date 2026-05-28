import type { ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useProfile } from "@/entities/user";
import { canAccessAdminDashboard } from "@/entities/admin-analytics";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

type AdminDashboardGuardProps = {
  children: ReactNode;
};

export function AdminDashboardGuard({ children }: AdminDashboardGuardProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { data: profile, isLoading } = useProfile();
  const styles = useThemeStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (!canAccessAdminDashboard(profile?.account_role)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{t("adminDashboard.denied.title")}</Text>
        <Text style={styles.muted}>{t("adminDashboard.denied.body")}</Text>
        <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t("adminDashboard.denied.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

function createStyles({
  colors,
}: {
  colors: { background: string; text: string; textMuted: string; primary: string; onPrimary: string };
}) {
  return {
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: colors.background,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    muted: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
    btn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    btnText: { color: colors.onPrimary, fontWeight: "700" },
  };
}
