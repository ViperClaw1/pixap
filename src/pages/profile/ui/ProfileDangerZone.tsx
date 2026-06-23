import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppPressable } from "@/shared/ui/app-pressable";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useDeleteAccount } from "@/entities/user";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import {
  buildAccountDeletionConfirmPhrase,
  isAccountDeletionConfirmed,
} from "../model/accountDeletion";
import { useProfileDangerZoneStyles } from "./profileDangerZoneStyles";

const SUCCESS_COLOR = "#22c55e";

type Props = {
  username: string;
  onConfirmInputFocus?: () => void;
  onConfirmInputBlur?: () => void;
};

export function ProfileDangerZone({ username, onConfirmInputFocus, onConfirmInputBlur }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">>();
  const deleteAccount = useDeleteAccount();
  const styles = useProfileDangerZoneStyles();
  const [confirmation, setConfirmation] = useState("");
  const [showModal, setShowModal] = useState(false);

  const trimmedUsername = username.trim();
  const confirmPhrase = useMemo(
    () => (trimmedUsername ? buildAccountDeletionConfirmPhrase(trimmedUsername) : ""),
    [trimmedUsername],
  );
  const canDelete = Boolean(trimmedUsername) && isAccountDeletionConfirmed(confirmation, trimmedUsername);

  const confirmMatch = canDelete;
  const confirmMatchPct = useMemo(() => {
    const typed = confirmation.trim();
    if (!typed || !confirmPhrase) return 0;
    const matched = typed.split("").filter((c, i) => c === confirmPhrase[i]).length;
    return Math.round((matched / confirmPhrase.length) * 100);
  }, [confirmation, confirmPhrase]);

  const handleDelete = useCallback(() => {
    setShowModal(false);
    void deleteAccount
      .mutateAsync(confirmation.trim())
      .then(() => {
        Alert.alert(t("profile.dangerZone.successTitle"), t("profile.dangerZone.successBody"), [
          {
            text: t("common.ok"),
            onPress: () => navigation.reset({ index: 0, routes: [{ name: "Auth" }] }),
          },
        ]);
      })
      .catch((error) => {
        Alert.alert(
          t("profile.dangerZone.failedTitle"),
          formatErrorForAlert(error, t("profile.dangerZone.failedBody")),
        );
      });
  }, [confirmation, deleteAccount, navigation, t]);

  const handleDeletePress = useCallback(() => {
    if (!canDelete || deleteAccount.isPending) return;
    setShowModal(true);
  }, [canDelete, deleteAccount.isPending]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons
          name="warning"
          size={18}
          color={colors.danger}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={styles.title}>{t("profile.dangerZone.title")}</Text>
      </View>
      <Text style={styles.description}>{t("profile.dangerZone.description")}</Text>

      {!trimmedUsername ? (
        <Text style={styles.warningText}>{t("profile.dangerZone.usernameRequired")}</Text>
      ) : (
        <>
          <Text style={styles.confirmLabel}>{t("profile.dangerZone.confirmLabel")}</Text>
          <Text style={styles.confirmHint}>{t("profile.dangerZone.confirmHint", { phrase: confirmPhrase })}</Text>
          <TextInput
            style={styles.input}
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder={t("profile.dangerZone.confirmPlaceholder", { phrase: confirmPhrase })}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            onFocus={onConfirmInputFocus}
            onBlur={onConfirmInputBlur}
            accessibilityLabel={t("profile.dangerZone.confirmLabel")}
            accessibilityHint={t("profile.dangerZone.confirmHint", { phrase: confirmPhrase })}
            accessibilityRole="text"
          />

          {confirmation.trim().length > 0 && (
            <View style={styles.matchFeedbackRow}>
              <Ionicons
                name={confirmMatch ? "checkmark-circle" : "close-circle"}
                size={18}
                color={confirmMatch ? SUCCESS_COLOR : colors.danger}
              />
              <Text style={[styles.matchFeedbackText, { color: confirmMatch ? SUCCESS_COLOR : colors.danger }]}>
                {confirmMatch
                  ? t("profile.dangerZone.confirmMatches")
                  : t("profile.dangerZone.confirmMismatches", { percentage: confirmMatchPct })}
              </Text>
            </View>
          )}

          <AppPressable
            style={[styles.deleteBtn, !canDelete || deleteAccount.isPending ? styles.deleteBtnDisabled : null]}
            onPress={handleDeletePress}
            disabled={!canDelete || deleteAccount.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("profile.dangerZone.deleteButton")}
            accessibilityHint={
              !canDelete
                ? t("profile.dangerZone.deleteButtonDisabledHint")
                : t("profile.dangerZone.deleteButtonEnabledHint")
            }
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text
                style={[styles.deleteBtnText, !canDelete ? styles.deleteBtnDisabledText : null]}
              >
                {t("profile.dangerZone.deleteButton")}
              </Text>
            )}
          </AppPressable>
        </>
      )}

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("profile.dangerZone.confirmDeleteTitle")}</Text>
            <Text style={styles.modalBody}>{t("profile.dangerZone.confirmDeleteBody")}</Text>

            <View style={styles.modalButtonRow}>
              <AppPressable
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </AppPressable>

              <AppPressable
                style={styles.confirmDeleteBtn}
                onPress={handleDelete}
                disabled={deleteAccount.isPending}
                accessibilityRole="button"
                accessibilityLabel={t("profile.dangerZone.deleteIrrevocably")}
              >
                {deleteAccount.isPending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>
                    {t("profile.dangerZone.deleteIrrevocably")}
                  </Text>
                )}
              </AppPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
