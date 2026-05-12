import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, Animated, Platform, Keyboard } from "react-native";
import { useKeyboardInset } from "@/shared/lib/keyboard";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import Toast from "react-native-toast-message";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
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
    if (!__DEV__) return;
    console.info("[ResetPassword] Screen mounted.");
    console.info("[ResetPassword] Incoming URL:", url ?? "<empty>");
    void supabase.auth.getSession().then(({ data: { session } }) => {
      console.info("[ResetPassword] Session available:", Boolean(session?.access_token));
      console.info("[ResetPassword] Session user:", session?.user?.id ?? "<none>");
    });
  }, [url]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
        content: {
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
        title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8 },
        hint: { color: colors.textMuted, marginBottom: 16, fontSize: 14 },
        fieldWrap: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.card,
        },
        fieldWrapError: {
          borderColor: colors.danger,
        },
        input: {
          fontSize: 16,
          color: colors.text,
          flex: 1,
          paddingVertical: 0,
        },
        passwordRules: {
          marginTop: -2,
          marginBottom: 10,
          gap: 4,
        },
        passwordRuleItem: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 18,
        },
        inlineError: {
          marginTop: -4,
          marginBottom: 10,
          color: colors.danger,
          fontSize: 12,
        },
        btn: { ...primaryPressableStyle, marginTop: 8, borderRadius: 12 },
        btnDisabled: { opacity: 0.6 },
        btnText: primaryPressableTextStyle,
      }),
    [colors, insets.top, insets.bottom],
  );

  return (
    <AnimatedScrollView
      style={stylesThemed.root}
      contentContainerStyle={[stylesThemed.content, { paddingBottom: keyboardInset }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      <Text style={stylesThemed.title}>{t(RESET_PASSWORD_COPY_KEYS.title)}</Text>
      {url ? (
        <Text style={stylesThemed.hint}>{t(RESET_PASSWORD_COPY_KEYS.hintLinkReceived)}</Text>
      ) : (
        <Text style={stylesThemed.hint}>{t(RESET_PASSWORD_COPY_KEYS.hintChooseNew)}</Text>
      )}
      <Pressable
        style={[stylesThemed.fieldWrap]}
        onPress={() => undefined}
      >
        <TextInput
          style={stylesThemed.input}
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
        <Pressable style={stylesThemed.passwordRules} onPress={() => undefined}>
          {RESET_PASSWORD_RULE_KEYS.map((ruleKey, idx) => {
            const isSatisfied = passwordRuleStates[idx] ?? false;
            return (
              <Text key={ruleKey} style={[stylesThemed.passwordRuleItem, { color: passwordRuleColor(isSatisfied) }]}>
                • {t(ruleKey)}
              </Text>
            );
          })}
        </Pressable>
      ) : null}
      <Pressable
        style={[stylesThemed.fieldWrap, showPasswordsMismatch ? stylesThemed.fieldWrapError : null]}
        onPress={() => undefined}
      >
        <TextInput
          style={stylesThemed.input}
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
      {showPasswordsMismatch ? <Text style={stylesThemed.inlineError}>{t("auth.inlinePasswordsMismatch")}</Text> : null}
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
      <Pressable
        style={[stylesThemed.btn, busy ? stylesThemed.btnDisabled : null]}
        disabled={busy}
        onPress={async () => {
          if (__DEV__) {
            console.info("[ResetPassword] Submit pressed.");
          }
          Keyboard.dismiss();
          if (password.length < 8) {
            if (__DEV__) {
              console.info("[ResetPassword] Validation failed: password too short.");
            }
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertTooShortTitle), t(RESET_PASSWORD_COPY_KEYS.alertTooShortBody));
            return;
          }
          if (!isPasswordPolicyValid) {
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertWeakTitle), t(RESET_PASSWORD_COPY_KEYS.passwordPolicyBody));
            return;
          }
          if (password !== confirm) {
            if (__DEV__) {
              console.info("[ResetPassword] Validation failed: password mismatch.");
            }
            setConfirmPasswordTouched(true);
            Alert.alert(t(RESET_PASSWORD_COPY_KEYS.alertMismatchTitle), t(RESET_PASSWORD_COPY_KEYS.passwordsMismatchBody));
            return;
          }
          setBusy(true);
          try {
            const { error } = await updatePassword(password);
            if (error) {
              if (__DEV__) {
                console.info("[ResetPassword] Password update failed:", error);
              }
              Toast.show({ type: "error", text1: t(RESET_PASSWORD_COPY_KEYS.toastUpdateFailedTitle), text2: error });
              return;
            }
            if (__DEV__) {
              console.info("[ResetPassword] Password updated successfully. Navigating to ProfileMain.");
            }
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
        <Text style={stylesThemed.btnText}>{t(RESET_PASSWORD_COPY_KEYS.btnUpdate)}</Text>
      </Pressable>
    </AnimatedScrollView>
  );
}
