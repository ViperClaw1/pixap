import { AppPressable } from "@/shared/ui/app-pressable";
import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { supabase } from "@/shared/api/supabase/client";
import { registerNativePushToken } from "@/shared/lib/push/pushNotifications";
import { setSeenPermissionsIntro } from "@/shared/lib/permissionsStorage";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

type Props = {
  onComplete: () => void;
};

export default function PermissionsOnboardingScreen({ onComplete }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await setSeenPermissionsIntro();
    setBusy(false);
    onComplete();
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) {
        await registerNativePushToken(data.user.id);
      }
    } finally {
      await setSeenPermissionsIntro();
      setBusy(false);
      onComplete();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="notifications" size={48} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{t("pushPermissions.title")}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t("pushPermissions.body")}</Text>

      <View style={[styles.demoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.demoIconWrap, { backgroundColor: colors.primary }]}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>
        <View style={styles.demoText}>
          <View style={styles.demoHeader}>
            <Text style={[styles.demoApp, { color: colors.text }]}>PixApp</Text>
            <Text style={[styles.demoTime, { color: colors.textMuted }]}>{t("common.now", "now")}</Text>
          </View>
          <Text style={[styles.demoTitle, { color: colors.text }]} numberOfLines={1}>
            {t("pushPermissions.demoTitle")}
          </Text>
          <Text style={[styles.demoBody, { color: colors.textMuted }]} numberOfLines={2}>
            {t("pushPermissions.demoBody")}
          </Text>
        </View>
      </View>

      {busy ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <View style={styles.actions}>
          <AppPressable style={primaryPressableStyle} onPress={() => void enableNotifications()}>
            <Text style={primaryPressableTextStyle}>{t("pushPermissions.enableBtn")}</Text>
          </AppPressable>
          <AppPressable style={styles.skip} onPress={() => void finish()}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>{t("pushPermissions.skipBtn")}</Text>
          </AppPressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28, justifyContent: "center" },
  iconWrap: { alignItems: "center", marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  demoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  demoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  demoText: { flex: 1 },
  demoHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  demoApp: { fontSize: 12, fontWeight: "700" },
  demoTime: { fontSize: 11 },
  demoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  demoBody: { fontSize: 12, lineHeight: 16 },
  actions: { marginTop: 24, gap: 10 },
  skip: { paddingVertical: 12, alignItems: "center" },
  skipText: { fontWeight: "600", fontSize: 14 },
});
