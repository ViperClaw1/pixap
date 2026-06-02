import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
  Linking
} from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { useFocusedOverlapKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons, FontAwesome, FontAwesome6 } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import { markOAuthCallbackHandled } from "@/shared/lib/oauthCallbackHandled";
import { env } from "@/shared/lib/env";
import { getOAuthRedirectUri } from "@/shared/lib/oauthRedirect";
import { isNewAuthRegistration } from "@/shared/lib/auth/isNewAuthRegistration";
import type { ProfileStackParamList } from "@/app/navigation/types";

type PostAuthRoute = "ProfileMain" | "EditProfile";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { authStaticStyles, authThemeStyles } from "./authStyles";
import { devError, devInfo } from "@/shared/lib/devLog";
import { appAlert } from "@/shared/ui/app-popup";
import type { AppPopupVariant } from "@/shared/ui/app-popup";
import { COMMUNITY_GUIDELINES_URL, TERMS_URL } from "@/shared/lib/legalUrls";

WebBrowser.maybeCompleteAuthSession();

type Mode = "login" | "signup" | "forgot";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Auth">;
const KEYBOARD_GAP = Platform.OS === "android" ? 48 : 24;
const PASSWORD_RULE_SUCCESS_COLOR = "#22c55e";

export default function AuthScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, mode: themeMode } = useAppTheme();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const activeInputRef = useRef<TextInput | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const isKeyboardVisibleRef = useRef(false);
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authTransition, setAuthTransition] = useState(false);
  const authRequestInFlightRef = useRef(false);
  const postAuthRouteRef = useRef<PostAuthRoute>("ProfileMain");
  const hadUserWhenAuthReadyRef = useRef<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [keyboardOverlapPad, setKeyboardOverlapPad] = useState(0);
  const baseScrollPaddingBottom = Math.max(insets.bottom, 48);
  const { extraInset: keyboardExtraInset, recalculate: recalculateKeyboardInset } =
    useFocusedOverlapKeyboardInset({
      gap: KEYBOARD_GAP,
      getFocusedInput: () => activeInputRef.current,
      onKeyboardFrame: (keyboardTop, keyboardHeight) => {
        const windowHeight = Dimensions.get("window").height;
        keyboardTopRef.current = keyboardTop < windowHeight ? keyboardTop : null;
        isKeyboardVisibleRef.current = keyboardHeight > 1;
      },
      onKeyboardChange: (keyboardTop, keyboardHeight) => {
        if (keyboardHeight > 1) {
          ensureFocusedInputVisible(keyboardTop);
        }
      },
    });
  useAnimatedReaction(
    () => keyboardExtraInset.value,
    (value, prev) => {
      if (value === prev) return;
      runOnJS(setKeyboardOverlapPad)(value);
    },
    [keyboardExtraInset],
  );

  const themed = useThemeStyles(({ colors: c }) => authThemeStyles(c));
  const styles = useMemo(() => mergeStaticAndThemed(authStaticStyles, themed), [themed]);

  const showUserAlert = useCallback(
    (title: string, message?: string, variant: AppPopupVariant = "alert") => {
      appAlert(title, message, [{ text: t("common.ok") }], variant);
    },
    [t],
  );

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const hasMinPasswordLength = password.length >= 8;
  const hasPasswordDigit = /\d/.test(password);
  const hasPasswordUppercase = /[A-Z]/.test(password);
  const hasPasswordSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordPolicyValid = hasMinPasswordLength && hasPasswordDigit && hasPasswordUppercase && hasPasswordSpecial;
  const isEmailEmpty = email.trim().length === 0;
  const showEmailRequiredError = emailTouched && isEmailEmpty;
  const showEmailInvalidError = emailTouched && !isEmailEmpty && !isValidEmail(email);
  const arePasswordsMatching = password === confirmPassword;
  const showPasswordsMismatch = mode === "signup" && confirmPasswordTouched && confirmPassword.length > 0 && !arePasswordsMatching;
  const showPasswordPolicyError = mode === "signup" && passwordTouched && password.length > 0 && !isPasswordPolicyValid;

  const onPasswordChange = (value: string) => {
    if (!passwordTouched && value.length > 0) setPasswordTouched(true);
    setPassword(value);
  };

  const ensureFocusedInputVisible = useCallback((keyboardTop: number) => {
    const focusedField = activeInputRef.current;
    if (!focusedField || typeof focusedField.measureInWindow !== "function") return;
    focusedField.measureInWindow((_x, y, _w, h) => {
      const overlap = Math.max(0, y + h + KEYBOARD_GAP - keyboardTop);
      if (overlap <= 0) return;
      scrollRef.current?.scrollTo({
        y: scrollOffsetYRef.current + overlap,
        animated: true,
      });
    });
  }, []);

  const onInputFocus = (ref: { current: TextInput | null | undefined }) => {
    /** React 19: `ref.current` must not be set to `undefined` — only `null` or the instance. */
    activeInputRef.current = ref.current ?? null;
    const keyboardTop = keyboardTopRef.current;
    if (!isKeyboardVisibleRef.current || keyboardTop == null || !ref.current) return;
    recalculateKeyboardInset();
    ensureFocusedInputVisible(keyboardTop);
  };

  const beginAuthTransition = useCallback((route: PostAuthRoute) => {
    postAuthRouteRef.current = route;
    setAuthTransition(true);
  }, []);

  const resolveSocialPostAuthRoute = useCallback(async (): Promise<PostAuthRoute> => {
    const { data: { session } } = await supabase.auth.getSession();
    const authUser = session?.user;
    if (authUser && isNewAuthRegistration(authUser)) {
      return "EditProfile";
    }
    return "ProfileMain";
  }, []);

  useEffect(() => {
    if (authLoading || !user || !authTransition) return;
    setAuthTransition(false);
    setLoading(false);
    authRequestInFlightRef.current = false;
    navigation.reset({ index: 0, routes: [{ name: postAuthRouteRef.current }] });
  }, [authLoading, authTransition, navigation, user]);

  useEffect(() => {
    if (authLoading) return;
    if (hadUserWhenAuthReadyRef.current !== null) return;
    hadUserWhenAuthReadyRef.current = Boolean(user);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || authTransition || !hadUserWhenAuthReadyRef.current) return;
    navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
  }, [authLoading, authTransition, navigation, user]);

  const finishAuthAttempt = useCallback((keepLoading: boolean) => {
    if (keepLoading) return;
    authRequestInFlightRef.current = false;
    setLoading(false);
  }, []);

  const social = async (provider: "google" | "apple") => {
    if (authRequestInFlightRef.current) return;
    authRequestInFlightRef.current = true;
    setLoading(true);
    let keepLoading = false;
    try {
      const isExpoGo = Constants.appOwnership === "expo";
      devInfo("[Auth][social] provider:", provider, "platform:", Platform.OS, "expoGo:", isExpoGo);

      if (provider === "apple" && Platform.OS === "ios" && !isExpoGo) {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        devInfo("[Apple][native] available:", isAvailable);
        if (!isAvailable) {
          showUserAlert(t("auth.alerts.appleUnavailableTitle"), t("auth.alerts.appleUnavailableBody"));
          return;
        }

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        const token = credential.identityToken;
        devInfo("[Apple][native] token received:", Boolean(token), "user:", credential.user ?? "n/a");
        if (!token) {
          showUserAlert(t("auth.alerts.signInFailed"), t("auth.alerts.appleNoToken"));
          return;
        }

        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token,
        });
        if (error) {
          devError("[Apple][native] signInWithIdToken error:", error.message);
          showUserAlert(t("auth.alerts.signInFailed"), error.message);
          return;
        }
        devInfo("[Apple][native] signInWithIdToken success");
        beginAuthTransition(await resolveSocialPostAuthRoute());
        keepLoading = true;
        return;
      }

      try {
        devInfo("[OAuth] Supabase host:", new URL(env.supabaseUrl).hostname);
      } catch {
        /* ignore */
      }
      const redirectTo = getOAuthRedirectUri();
      devInfo("[OAuth] redirectTo:", redirectTo, "provider:", provider);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL");
      devInfo("[OAuth] auth URL generated:", data.url.slice(0, 140));
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      devInfo("[OAuth] openAuthSession result:", result.type);
      if (result.type === "success" && result.url) {
        devInfo("[OAuth] callback URL:", result.url);
        const finished = await completeOAuthFromCallbackUrl(result.url);
        if (finished.ok) devInfo("[OAuth] callback exchange: success");
        else devError("[OAuth] callback exchange: failed:", finished.message);
        if (!finished.ok) {
          showUserAlert(t("auth.alerts.signInFailed"), finished.message);
          return;
        }
        markOAuthCallbackHandled(result.url);
        beginAuthTransition(await resolveSocialPostAuthRoute());
        keepLoading = true;
        return;
      }
      if (result.type !== "success") {
        showUserAlert(t("auth.alerts.signInCancelled"), undefined, "info");
      }
    } catch (e: unknown) {
      showUserAlert(t("auth.alerts.oauthError"), e instanceof Error ? e.message : t("auth.alerts.unknown"));
    } finally {
      finishAuthAttempt(keepLoading);
    }
  };

  const submit = async () => {
    if (authRequestInFlightRef.current) return;
    authRequestInFlightRef.current = true;
    setLoading(true);
    let keepLoading = false;
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          showUserAlert(t("auth.alerts.signInFailed"), error);
          return;
        }
        beginAuthTransition("ProfileMain");
        keepLoading = true;
        return;
      }
      if (mode === "signup") {
        setEmailTouched(true);
        setPasswordTouched(true);
        setConfirmPasswordTouched(true);
        if (isEmailEmpty) {
          showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.emailRequired"));
          return;
        }
        if (!isValidEmail(email)) {
          showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.emailInvalid"));
          return;
        }
        if (!isPasswordPolicyValid) {
          showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.passwordPolicy"));
          return;
        }
        if (!arePasswordsMatching) {
          showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.passwordsMismatch"));
          return;
        }
        if (!termsAccepted) {
          showUserAlert(t("auth.alerts.validationTitle"), t("legal.acceptTermsRequired"));
          return;
        }
        const { error, isUserAlreadyExists } = await signUp(email, password, firstName, lastName, true);
        if (error) {
          if (isUserAlreadyExists) {
            showUserAlert(t("auth.alerts.emailAlreadyRegisteredTitle"), t("auth.alerts.emailAlreadyRegisteredBody"), "info");
            return;
          }
          showUserAlert(t("auth.alerts.signUpFailed"), error);
          return;
        }
        const signInResult = await signIn(email, password);
        if (signInResult.error) {
          showUserAlert(t("auth.alerts.signUpAutoSignInFailedTitle"), t("auth.alerts.signUpAutoSignInFailedBody"));
          setMode("login");
          return;
        }
        beginAuthTransition("EditProfile");
        keepLoading = true;
        return;
      }
      setEmailTouched(true);
      if (isEmailEmpty) {
        showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.emailRequired"));
        return;
      }
      if (!isValidEmail(email)) {
        showUserAlert(t("auth.alerts.validationTitle"), t("auth.alerts.emailInvalid"));
        return;
      }
      navigation.navigate("VerifyEmailOtp", { flow: "recovery", email: email.trim() });
    } finally {
      finishAuthAttempt(keepLoading);
    }
  };

  const showSubmitLoading = loading || authTransition;
  const ph = colors.textMuted;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 22),
          paddingBottom: baseScrollPaddingBottom + keyboardOverlapPad,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onScroll={(event) => {
        scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <Text style={styles.title}>
        {mode === "login" ? t("auth.titleLogin") : mode === "signup" ? t("auth.titleSignup") : t("auth.titleForgot")}
      </Text>
      <Text style={styles.helper}>
        {mode === "forgot" ? t("auth.helperForgot") : t("auth.helperDefault")}
      </Text>

      {mode === "signup" && (
        <>
          <View style={styles.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              ref={firstNameInputRef}
              style={styles.input}
              placeholder={t("auth.placeholderFirstName")}
              placeholderTextColor={ph}
              value={firstName}
              onChangeText={setFirstName}
              onFocus={() => onInputFocus(firstNameInputRef)}
            />
          </View>
          <View style={styles.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              ref={lastNameInputRef}
              style={styles.input}
              placeholder={t("auth.placeholderLastName")}
              placeholderTextColor={ph}
              value={lastName}
              onChangeText={setLastName}
              onFocus={() => onInputFocus(lastNameInputRef)}
            />
          </View>
        </>
      )}

      <View style={[styles.fieldWrap, (showEmailRequiredError || showEmailInvalidError) ? styles.fieldWrapError : null]}>
        <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
        <TextInput
          ref={emailInputRef}
          style={styles.input}
          placeholder={t("auth.placeholderEmail")}
          placeholderTextColor={ph}
          value={email}
          onChangeText={setEmail}
          onFocus={() => onInputFocus(emailInputRef)}
          onBlur={() => {
            setEmailTouched(true);
            if (activeInputRef.current === emailInputRef.current) activeInputRef.current = null;
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      {showEmailRequiredError ? <Text style={styles.inlineError}>{t("auth.inlineEmailRequired")}</Text> : null}
      {showEmailInvalidError ? <Text style={styles.inlineError}>{t("auth.inlineEmailInvalid")}</Text> : null}
      {mode !== "forgot" && (
        <>
          <View style={[styles.fieldWrap, showPasswordPolicyError ? styles.fieldWrapError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder={t("auth.placeholderPassword")}
              placeholderTextColor={ph}
              value={password}
              onChangeText={onPasswordChange}
              onFocus={() => onInputFocus(passwordInputRef)}
              onBlur={() => {
                setPasswordTouched(true);
                if (activeInputRef.current === passwordInputRef.current) activeInputRef.current = null;
              }}
              secureTextEntry={!showPassword}
            />
            <AppPressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
            </AppPressable>
          </View>
          {mode === "signup" && passwordTouched ? (
            <View style={styles.passwordRules}>
              <View style={styles.passwordRuleRow}>
                <Ionicons
                  name={hasMinPasswordLength ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasMinPasswordLength ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[styles.passwordRuleText, hasMinPasswordLength ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleMinLength")}
                </Text>
              </View>
              <View style={styles.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordUppercase ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordUppercase ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[styles.passwordRuleText, hasPasswordUppercase ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleUppercase")}
                </Text>
              </View>
              <View style={styles.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordDigit ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordDigit ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[styles.passwordRuleText, hasPasswordDigit ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleDigit")}
                </Text>
              </View>
              
              <View style={styles.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordSpecial ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordSpecial ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[styles.passwordRuleText, hasPasswordSpecial ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleSpecial")}
                </Text>
              </View>
            </View>
          ) : null}
          {mode === "signup" ? (
            <>
              <View style={[styles.fieldWrap, showPasswordsMismatch ? styles.fieldWrapError : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
                <TextInput
                  ref={confirmPasswordInputRef}
                  style={styles.input}
                  placeholder={t("auth.placeholderConfirmPassword")}
                  placeholderTextColor={ph}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => onInputFocus(confirmPasswordInputRef)}
                  onBlur={() => {
                    setConfirmPasswordTouched(true);
                    if (activeInputRef.current === confirmPasswordInputRef.current) activeInputRef.current = null;
                  }}
                  secureTextEntry={!showConfirmPassword}
                />
                <AppPressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
                  <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                </AppPressable>
              </View>
              {showPasswordsMismatch ? <Text style={styles.inlineError}>{t("auth.inlinePasswordsMismatch")}</Text> : null}
              <AppPressable style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)}>
                <Ionicons
                  name={termsAccepted ? "checkbox" : "square-outline"}
                  size={22}
                  color={termsAccepted ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.termsText, { color: colors.textMuted }]}>
                  {t("legal.acceptTermsPrefix")}{" "}
                  <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(TERMS_URL)}>
                    {t("legal.terms")}
                  </Text>{" "}
                  {t("legal.acceptTermsAnd")}{" "}
                  <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(COMMUNITY_GUIDELINES_URL)}>
                    {t("legal.communityGuidelines")}
                  </Text>
                </Text>
              </AppPressable>
            </>
          ) : null}
        </>
      )}

      {showSubmitLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : (
        <AppPressable style={styles.primary} onPress={() => void submit()}>
          <Text style={styles.primaryText}>
            {mode === "login" ? t("auth.btnSignIn") : mode === "signup" ? t("auth.btnSignUp") : t("auth.btnSendReset")}
          </Text>
        </AppPressable>
      )}

      {mode === "login" ? (
        <AppPressable style={styles.smallLink} onPress={() => setMode("forgot")}>
          <Text style={styles.smallLinkText}>{t("auth.forgotPassword")}</Text>
        </AppPressable>
      ) : null}
      {mode === "forgot" ? (
        <AppPressable style={styles.smallLink} onPress={() => setMode("login")}>
          <Text style={styles.smallLinkText}>{t("auth.backToSignIn")}</Text>
        </AppPressable>
      ) : null}

      {mode !== "forgot" && (
        <>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t("auth.or")}</Text>
            <View style={styles.orLine} />
          </View>
          <AppPressable style={styles.outline} onPress={() => void social("google")} disabled={showSubmitLoading}>
            <FontAwesome name="google" size={18} color={colors.accent} />
            <Text style={styles.outlineText}>{t("auth.continueGoogle")}</Text>
          </AppPressable>
          {Platform.OS !== "android" ? (
            <AppPressable style={styles.outline} onPress={() => void social("apple")} disabled={showSubmitLoading}>
              <FontAwesome6 name="apple" size={18} color={themeMode === "dark" ? colors.onAccent : colors.accent} />
              <Text style={styles.outlineText}>{t("auth.continueApple")}</Text>
            </AppPressable>
          ) : null}
        </>
      )}

      {mode === "login" ? (
        <AppPressable style={styles.bottomSwitch} onPress={() => setMode("signup")}>
          <Text style={styles.bottomSwitchText}>{t("auth.noAccount")}</Text>
          <Text style={styles.bottomSwitchLink}>{t("auth.signUpLink")}</Text>
        </AppPressable>
      ) : null}
      {mode === "signup" ? (
        <AppPressable style={styles.bottomSwitch} onPress={() => setMode("login")}>
          <Text style={styles.bottomSwitchText}>{t("auth.haveAccount")}</Text>
          <Text style={styles.bottomSwitchLink}>{t("auth.signInLink")}</Text>
        </AppPressable>
      ) : null}
    </ScrollView>
  );
}
