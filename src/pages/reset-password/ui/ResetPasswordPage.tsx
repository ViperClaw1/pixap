import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, Pressable, Alert, ActivityIndicator, Platform, Keyboard } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import Toast from "react-native-toast-message";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { resetPasswordStaticStyles, resetPasswordThemeStyles } from "./resetPasswordStyles";
import { devInfo } from "@/shared/lib/devLog";
import { supabase } from "@/shared/api/supabase/client";
import { RESET_PASSWORD_COPY_KEYS, RESET_PASSWORD_RULE_KEYS } from "../model/constants";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ResetPassword">;

/** Handles deep-link tokens from email; user sets new password here. */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { updatePassword } = useAuth();
  const keyboardInset = useKeyboardInset({ bottomInset: insets.bottom });
  const scrollContentStyle = useAnimatedStyle(
    () => ({
      flexGrow: 1,
      justifyContent: "center",
      paddingTop: Math.max(insets.top, 24),
      paddingBottom: Math.max(insets.bottom, 24) + keyboardInset.value,
    }),
    [insets.top, insets.bottom, keyboardInset],
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const url = Linking.useURL();

  const hasMinPasswordLength = password.length >= 8;
  const hasPasswordDigit = /\d/.test(password);
  const hasPasswordUppercase = /[A-Z]/.test(password);
  const hasPasswordSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordPolicyValid = hasMinPasswordLength && hasPasswordDigit && hasPasswordUppercase && hasPasswordSpecial;
  const arePasswordsMatching = password === confirm;
  const showPasswordsMismatch = confirmPasswordTouched && confirm.length > 0 && !arePasswordsMatching;
  const passwordRuleColor = (ok: boolean) => (ok ? "#22c55e" : colors.textMuted);
  const passwordRuleStates = [hasMinPasswordLength, hasPasswordUppercase, hasPasswordDigit, hasPasswordSpecial] as const;

  useEffect(() => {
    devInfo("[ResetPassword] Screen mounted.");
    devInfo("[ResetPassword] Incoming URL:", url ?? "<empty>");
    void supabase.auth.getSession().then(({ data: { session } }) => {
      devInfo("[ResetPassword] Session available:", Boolean(session?.access_token));
      devInfo("[ResetPassword] Session user:", session?.user?.id ?? "<none>");
    });
  }, [url]);

  const themed = useThemeStyles(({ colors: c }) => resetPasswordThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(resetPasswordStaticStyles, themed),
    [themed],
  );

  return (
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, scrollContentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      <Text style={styles.title}>{t(RESET_PASSWORD_COPY_KEYS.title)}</Text>
      {url ? (
        <Text style={styles.hint}>{t(RESET_PASSWORD_COPY_KEYS.hintLinkReceived)}</Text>
      ) : (
        <Text style={styles.hint}>{t(RESET_PASSWORD_COPY_KEYS.hintChooseNew)}</Text>
      )}
      <Pressable
        style={[styles.fieldWrap]}
        onPress={() => undefined}
      >
        <TextInput
          style={styles.input}
          placeholder={t("auth.placeholderPassword")}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={(value) => {
            if (!passwordTouched && value.length > 0) setPasswordTouched(true);
            setPassword(value);
          }}
          secureTextEntry={!showPassword}
          onBlur={() => setPasswordTouched(true)}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
        </Pressable>
      </Pressable>
      {passwordTouched ? (
        <Pressable style={styles.passwordRules} onPress={() => undefined}>
          {RESET_PASSWORD_RULE_KEYS.map((ruleKey, idx) => {
            const isSatisfied = passwordRuleStates[idx] ?? false;
            return (
              <Text key={ruleKey} style={[styles.passwordRuleItem, { color: passwordRuleColor(isSatisfied) }]}>
                • {t(ruleKey)}
              </Text>
            );
          })}
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.fieldWrap, showPasswordsMismatch ? styles.fieldWrapError : null]}
        onPress={() => undefined}
      >
        <TextInput
          style={styles.input}
          placeholder={t("auth.placeholderConfirmPassword")}
          placeholderTextColor={colors.textMuted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showConfirmPassword}
          onBlur={() => setConfirmPasswordTouched(true)}
        />
        <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
          <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
        </Pressable>
      </Pressable>
      {showPasswordsMismatch ? <Text style={styles.inlineError}>{t("auth.inlinePasswordsMismatch")}</Text> : null}
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
      <Pressable
        style={[styles.btn, busy ? styles.btnDisabled : null]}
        disabled={busy}
        onPress={async () => {
          devInfo("[ResetPassword] Submit pressed.");
          Keyboard.dismiss();
          if (password.length < 8) {
            devInfo("[ResetPassword] Validation failed: password too short.");
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertTooShortTitle), t(RESET_PASSWORD_COPY_KEYS.alertTooShortBody));
            return;
          }
          if (!isPasswordPolicyValid) {
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertWeakTitle), t(RESET_PASSWORD_COPY_KEYS.passwordPolicyBody));
            return;
          }
          if (password !== confirm) {
            devInfo("[ResetPassword] Validation failed: password mismatch.");
            setConfirmPasswordTouched(true);
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertMismatchTitle), t(RESET_PASSWORD_COPY_KEYS.passwordsMismatchBody));
            return;
          }
          setBusy(true);
          try {
            const { error } = await updatePassword(password);
            if (error) {
              devInfo("[ResetPassword] Password update failed:", error);
              Toast.show({ type: "error", text1: t(RESET_PASSWORD_COPY_KEYS.toastUpdateFailedTitle), text2: error });
              return;
            }
            devInfo("[ResetPassword] Password updated successfully. Navigating to ProfileMain.");
            Toast.show({
              type: "success",
              text1: t(RESET_PASSWORD_COPY_KEYS.toastUpdatedTitle),
              text2: t(RESET_PASSWORD_COPY_KEYS.toastUpdatedBody),
            });
            navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text style={styles.btnText}>{t(RESET_PASSWORD_COPY_KEYS.btnUpdate)}</Text>
      </Pressable>
    </Animated.ScrollView>
  );
}
