import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, View } from "react-native";
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

  const trimmedUsername = username.trim();
  const confirmPhrase = useMemo(
    () => (trimmedUsername ? buildAccountDeletionConfirmPhrase(trimmedUsername) : ""),
    [trimmedUsername],
  );
  const canDelete = Boolean(trimmedUsername) && isAccountDeletionConfirmed(confirmation, trimmedUsername);

  const handleDelete = useCallback(() => {
    if (!canDelete || deleteAccount.isPending) return;

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
  }, [canDelete, confirmation, deleteAccount, navigation, t]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="warning" size={18} color={colors.danger} accessibilityElementsHidden importantForAccessibility="no" />
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
          />
          <AppPressable
            style={[styles.deleteBtn, !canDelete || deleteAccount.isPending ? styles.deleteBtnDisabled : null]}
            onPress={handleDelete}
            disabled={!canDelete || deleteAccount.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("profile.dangerZone.deleteButton")}
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.deleteBtnText}>{t("profile.dangerZone.deleteButton")}</Text>
            )}
          </AppPressable>
        </>
      )}
    </View>
  );
}
