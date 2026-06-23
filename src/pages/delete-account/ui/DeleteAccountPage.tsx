import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { AppPressable } from "@/shared/ui/app-pressable";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { AppPopupModal } from "@/shared/ui/app-popup";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile, useDeleteAccount } from "@/entities/user";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import { buildAccountDeletionConfirmPhrase } from "@/pages/profile/model/accountDeletion";

const DATA_DELETION_URL = "https://pixapp.kz/data-deletion";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "DeleteAccount">;

export default function DeleteAccountPage() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile } = useProfile({ enabled: !!user });
  const deleteAccount = useDeleteAccount();

  const [showModal, setShowModal] = useState(false);

  const username = profile?.username?.trim() ?? "";
  const confirmPhrase = useMemo(
    () => (username ? buildAccountDeletionConfirmPhrase(username) : ""),
    [username],
  );

  const handleDelete = useCallback(() => {
    void deleteAccount
      .mutateAsync(confirmPhrase)
      .then(() => {
        Alert.alert(
          t("profile.dangerZone.successTitle"),
          t("profile.dangerZone.successBody"),
          [
            {
              text: t("common.ok"),
              onPress: () =>
                navigation.reset({ index: 0, routes: [{ name: "Auth" }] }),
            },
          ],
        );
      })
      .catch((error) => {
        Alert.alert(
          t("profile.dangerZone.failedTitle"),
          formatErrorForAlert(error, t("profile.dangerZone.failedBody")),
        );
      });
  }, [confirmPhrase, deleteAccount, navigation, t]);

  const styles = useStyles(colors);

  const consequences = [
    { key: "profile", icon: "person-outline" as const },
    { key: "content", icon: "images-outline" as const },
    { key: "bookings", icon: "calendar-outline" as const },
    { key: "settings", icon: "settings-outline" as const },
  ] as const;

  return (
    <View style={styles.root}>
      <AppHeader
        title={t("profile.deleteAccount.screenTitle")}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.iconRing, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }]}>
              <Ionicons name="trash-outline" size={36} color={colors.danger} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.danger }]}>
              {t("profile.deleteAccount.screenTitle")}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              {t("profile.deleteAccount.subtitle")}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("profile.deleteAccount.whatGetsDeleted")}
            </Text>
            {consequences.map(({ key, icon }) => (
              <View key={key} style={styles.consequenceRow}>
                <View style={[styles.consequenceIconWrap, { backgroundColor: colors.dangerSurface }]}>
                  <Ionicons name={icon} size={16} color={colors.danger} />
                </View>
                <Text style={[styles.consequenceText, { color: colors.text }]}>
                  {t(`profile.deleteAccount.item_${key}`)}
                </Text>
              </View>
            ))}
          </View>

          <AppPressable
            style={styles.learnMoreRow}
            onPress={() => void WebBrowser.openBrowserAsync(DATA_DELETION_URL)}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.learnMoreText, { color: colors.primary }]}>
              {t("profile.deleteAccount.learnMore")}
            </Text>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
          </AppPressable>

          <View style={styles.spacer} />

          <AppPressable
            style={[
              styles.deleteBtn,
              { backgroundColor: colors.danger },
              deleteAccount.isPending && styles.deleteBtnDisabled,
            ]}
            onPress={() => setShowModal(true)}
            disabled={deleteAccount.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("profile.dangerZone.deleteButton")}
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.deleteBtnText, { color: colors.onPrimary }]}>
                {t("profile.dangerZone.deleteButton")}
              </Text>
            )}
          </AppPressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {showModal && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <AppPopupModal
            embedded
            visible
            variant="alert"
            title={t("profile.dangerZone.confirmDeleteTitle")}
            message={t("profile.dangerZone.confirmDeleteBody")}
            loading={deleteAccount.isPending}
            onClose={() => setShowModal(false)}
            buttons={[
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("profile.dangerZone.deleteIrrevocably"),
                style: "destructive",
                onPress: handleDelete,
                skipCloseOnPress: true,
              },
            ]}
          />
        </Modal>
      )}
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        kav: { flex: 1 },
        scroll: {
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 48,
        },
        hero: { alignItems: "center", marginBottom: 28 },
        iconRing: {
          width: 80,
          height: 80,
          borderRadius: 40,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        },
        heroTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8, textAlign: "center" },
        heroSubtitle: {
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
          maxWidth: 300,
        },
        card: {
          borderRadius: 14,
          borderWidth: 1,
          padding: 16,
          gap: 12,
          marginBottom: 16,
        },
        cardTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3, opacity: 0.7 },
        consequenceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        consequenceIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        },
        consequenceText: { fontSize: 14, flex: 1 },
        learnMoreRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 20,
          alignSelf: "center",
        },
        learnMoreText: { fontSize: 14, fontWeight: "600" },
        spacer: { flex: 1, minHeight: 24 },
        deleteBtn: {
          minHeight: 50,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        },
        deleteBtnDisabled: { opacity: 0.5 },
        deleteBtnText: { fontSize: 16, fontWeight: "700" },
      }),
    [colors],
  );
}
