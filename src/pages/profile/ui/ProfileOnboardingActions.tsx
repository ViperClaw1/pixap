import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { PageI18nProvider } from "@/shared/lib/i18n";
import { isOnboardingSkipped, useUpsertUserPreferences, useUserPreferences, type UserPreferences } from "@/entities/user-preferences";
import { useClearOnboardingVenueRatings } from "@/entities/venue-rating";
import { AppPopupModal } from "@/shared/ui/app-popup";

type ActionRow = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type StyleProps = {
  linkStyle: object;
  linkTextStyle: object;
  linkIconStyle?: object;
  textMuted: string;
};

type Props = StyleProps & {
  navigation: NavigationProp<ParamListBase>;
  hasUser: boolean;
};

function ProfileOnboardingActionsContent({
  navigation,
  hasUser,
  linkStyle,
  linkTextStyle,
  linkIconStyle,
  textMuted,
}: Props) {
  const { t } = useTranslation();
  const { data: userPrefs } = useUserPreferences();
  const upsertUserPrefs = useUpsertUserPreferences();
  const clearOnboardingRatings = useClearOnboardingVenueRatings();
  const [retakeConfirmVisible, setRetakeConfirmVisible] = useState(false);

  const openPreferenceOnboarding = useCallback(
    (retake = false) => {
      navigation.navigate("PreferenceOnboarding", { source: "profile", retake });
    },
    [navigation],
  );

  const confirmRetakeTasteProfile = useCallback(() => {
    void (async () => {
      await clearOnboardingRatings.mutateAsync();
      await upsertUserPrefs.mutateAsync({
        onboarding_completed: false,
        onboarding_step: "venue_categories",
        clear_skipped: true,
      });
      openPreferenceOnboarding(true);
    })();
  }, [clearOnboardingRatings, openPreferenceOnboarding, upsertUserPrefs]);

  const handleRetakeTasteProfile = useCallback(() => {
    setRetakeConfirmVisible(true);
  }, []);

  const rows: ActionRow[] = useMemo(() => {
    if (!hasUser) return [];
    const prefs = userPrefs as UserPreferences | null | undefined;
    const items: ActionRow[] = [];
    if (prefs && !prefs.onboarding_completed && isOnboardingSkipped(prefs)) {
      items.push({
        key: "complete-onboarding",
        label: t("completeOnboarding", { keyPrefix: "profile.actions" }),
        icon: "color-wand-outline",
        onPress: () => openPreferenceOnboarding(false),
      });
    }
    items.push({
      key: "update-preferences",
      label: t("updatePreferences", { keyPrefix: "profile.actions" }),
      icon: "options-outline",
      onPress: () => openPreferenceOnboarding(false),
    });
    if (prefs?.onboarding_completed) {
      items.push({
        key: "retake-taste",
        label: t("retakeTaste", { keyPrefix: "profile.actions" }),
        icon: "refresh-outline",
        onPress: handleRetakeTasteProfile,
      });
    }
    return items;
  }, [handleRetakeTasteProfile, hasUser, openPreferenceOnboarding, t, userPrefs]);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((item) => (
        <Pressable key={item.key} style={linkStyle} onPress={item.onPress}>
          <Ionicons name={item.icon} size={20} color={textMuted} style={linkIconStyle} />
          <Text style={linkTextStyle}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={textMuted} style={linkIconStyle} />
        </Pressable>
      ))}
      <Modal
        visible={retakeConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRetakeConfirmVisible(false)}
      >
        <AppPopupModal
          embedded
          visible={retakeConfirmVisible}
          variant="alert"
          title={t("retakeTasteTitle", { keyPrefix: "profile.actions" })}
          message={t("retakeTasteBody", { keyPrefix: "profile.actions" })}
          onClose={() => setRetakeConfirmVisible(false)}
          buttons={[
            { text: t("cancel", { keyPrefix: "common" }), style: "cancel" },
            {
              text: t("retakeTasteConfirm", { keyPrefix: "profile.actions" }),
              style: "destructive",
              onPress: confirmRetakeTasteProfile,
            },
          ]}
        />
      </Modal>
    </>
  );
}

export function ProfileOnboardingActions(props: Props) {
  return (
    <PageI18nProvider>
      <ProfileOnboardingActionsContent {...props} />
    </PageI18nProvider>
  );
}
