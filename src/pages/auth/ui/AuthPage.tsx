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
  Animated,
} from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { useFocusedOverlapKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons, FontAwesome, FontAwesome6 } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth, type AuthErrorCode } from "@/app/providers/AuthProvider";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import { markOAuthCallbackHandled } from "@/shared/lib/oauthCallbackHandled";
import { env } from "@/shared/lib/env";
import { getOAuthRedirectUri } from "@/shared/lib/oauthRedirect";
import { applyAppleCredentialProfile } from "@/shared/lib/auth/applyAppleCredentialProfile";
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
import { markAppLaunched } from "@/shared/lib/appLaunchStorage";
import {
  trackSignupStarted,
  trackSignupCompleted,
  trackLoginCompleted,
} from "@/shared/lib/analytics/track";

WebBrowser.maybeCompleteAuthSession();

type Mode = "login" | "signup" | "forgot";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Auth">;
const KEYBOARD_GAP = Platform.OS === "android" ? 48 : 24;
// Extra scroll clearance when password is focused in signup — ensures both policy bullets are visible above keyboard.
// Bullet rows ≈ 12px margin + 36px content + 8px gap = ~56px below password field.
const SIGNUP_PASSWORD_EXTRA_GAP = 60;
const PASSWORD_RULE_SUCCESS_COLOR = "#22c55e";

function getAuthErrorTranslationKey(code: AuthErrorCode | undefined): string {
  switch (code) {
    case "email_already_registered":
      return "auth.errors.emailAlreadyRegistered";
    case "invalid_email":
      return "auth.errors.invalidEmail";
    case "missing_required_fields":
      return "auth.errors.missingRequiredFields";
    case "weak_password":
      return "auth.errors.weakPassword";
    case "terms_required":
      return "auth.errors.termsRequired";
    case "invalid_credentials":
      return "auth.errors.invalidCredentials";
    case "email_not_confirmed":
      return "auth.errors.emailNotConfirmed";
    case "too_many_requests":
      return "auth.errors.tooManyRequests";
    case "unauthorized":
      return "auth.errors.unauthorized";
    case "email_mismatch":
      return "auth.errors.emailMismatch";
    case "invalid_otp":
      return "auth.errors.invalidOtp";
    case "expired_otp":
      return "auth.errors.expiredOtp";
    case "otp_send_failed":
      return "auth.errors.otpSendFailed";
    case "auth_service_unavailable":
      return "auth.errors.authServiceUnavailable";
    case "network_unavailable":
      return "auth.errors.networkUnavailable";
    case "unknown":
    default:
      return "auth.errors.generic";
  }
}

export default function AuthScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<ProfileStackParamList, "Auth">>();
  const insets = useSafeAreaInsets();
  const { colors, mode: themeMode } = useAppTheme();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetYRef = useRef(0);
  const activeInputRef = useRef<TextInput | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const isKeyboardVisibleRef = useRef(false);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<Mode>(route.params?.initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authTransition, setAuthTransition] = useState(false);
  const authRequestInFlightRef = useRef(false);
  const postAuthRouteRef = useRef<PostAuthRoute>("ProfileMain");
  const hadUserWhenAuthReadyRef = useRef<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [keyboardOverlapPad, setKeyboardOverlapPad] = useState(0);
  const [switcherWidth, setSwitcherWidth] = useState(0);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const tabSliderAnim = useRef(new Animated.Value(route.params?.initialMode === "signup" ? 1 : 0)).current;
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
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

  const getAuthErrorMessage = useCallback(
    (code: AuthErrorCode | undefined) => t(getAuthErrorTranslationKey(code)),
    [t],
  );

  const switchMode = useCallback(
    (newMode: "login" | "signup") => {
      if (newMode === mode) return;
      Animated.timing(tabSliderAnim, { toValue: newMode === "login" ? 0 : 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(contentOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setMode(newMode);
        setPassword("");
        setPasswordTouched(false);
        setTermsAccepted(false);
        setTermsError(false);
        Animated.timing(contentOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
    },
    [mode, contentOpacity, tabSliderAnim],
  );

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const hasMinPasswordLength = password.length >= 8;
  const hasLetterAndDigit = /[a-zA-Z]/.test(password) && /\d/.test(password);
  const isPasswordPolicyValid = hasMinPasswordLength && hasLetterAndDigit;
  const isEmailEmpty = email.trim().length === 0;
  const showEmailRequiredError = emailTouched && isEmailEmpty;
  const showEmailInvalidError = emailTouched && !isEmailEmpty && !isValidEmail(email);
  const showPasswordPolicyError = mode === "signup" && passwordTouched && password.length > 0 && !isPasswordPolicyValid;

  const onPasswordChange = (value: string) => {
    if (!passwordTouched && value.length > 0) setPasswordTouched(true);
    setPassword(value);
  };

  const ensureFocusedInputVisible = useCallback((keyboardTop: number) => {
    const focusedField = activeInputRef.current;
    if (!focusedField || typeof focusedField.measureInWindow !== "function") return;
    const isSignupPassword = modeRef.current !== "forgot" && focusedField === passwordInputRef.current;
    const gap = KEYBOARD_GAP + (isSignupPassword ? SIGNUP_PASSWORD_EXTRA_GAP : 0);
    focusedField.measureInWindow((_x, y, _w, h) => {
      const overlap = Math.max(0, y + h + gap - keyboardTop);
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
    if (route.params?.initialMode !== "signup") return;
    void markAppLaunched();
  }, [route.params?.initialMode]);

  useEffect(() => {
    if (mode === "signup") trackSignupStarted();
  }, [mode]);

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
          showUserAlert(t("auth.alerts.signInFailed"), getAuthErrorMessage("unknown"));
          return;
        }
        await applyAppleCredentialProfile(credential);
        devInfo("[Apple][native] signInWithIdToken success");
        // Apple HIG: do not ask for name/email after Sign in with Apple — use credential data and go to the app.
        const { data: { session: appleSession } } = await supabase.auth.getSession();
        if (appleSession?.user && isNewAuthRegistration(appleSession.user)) trackSignupCompleted("apple");
        else trackLoginCompleted("apple");
        beginAuthTransition("ProfileMain");
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
          showUserAlert(t("auth.alerts.signInFailed"), getAuthErrorMessage("unknown"));
          return;
        }
        markOAuthCallbackHandled(result.url);
        const oauthRoute = await resolveSocialPostAuthRoute();
        if (oauthRoute === "EditProfile") trackSignupCompleted(provider);
        else trackLoginCompleted(provider);
        beginAuthTransition(oauthRoute);
        keepLoading = true;
        return;
      }
      if (result.type !== "success") {
        showUserAlert(t("auth.alerts.signInCancelled"), undefined, "info");
      }
    } catch (e: unknown) {
      devError("[Auth][social] OAuth error:", e instanceof Error ? e.message : e);
      showUserAlert(t("auth.alerts.oauthError"), getAuthErrorMessage("unknown"));
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
        const { error, errorCode } = await signIn(email, password);
        if (error) {
          showUserAlert(t("auth.alerts.signInFailed"), getAuthErrorMessage(errorCode));
          return;
        }
        trackLoginCompleted("email");
        beginAuthTransition("ProfileMain");
        keepLoading = true;
        return;
      }
      if (mode === "signup") {
        setEmailTouched(true);
        setPasswordTouched(true);
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
        if (!termsAccepted) {
          setTermsError(true);
          scrollRef.current?.scrollToEnd({ animated: true });
          return;
        }
        const { error, errorCode, isUserAlreadyExists } = await signUp(email, password, true);
        if (error) {
          if (isUserAlreadyExists) {
            showUserAlert(t("auth.alerts.emailAlreadyRegisteredTitle"), t("auth.alerts.emailAlreadyRegisteredBody"), "info");
            return;
          }
          showUserAlert(t("auth.alerts.signUpFailed"), getAuthErrorMessage(errorCode));
          return;
        }
        const signInResult = await signIn(email, password);
        if (signInResult.error) {
          showUserAlert(t("auth.alerts.signUpAutoSignInFailedTitle"), t("auth.alerts.signUpAutoSignInFailedBody"));
          setMode("login");
          return;
        }
        trackSignupCompleted("email");
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
  const sliderTranslateX = tabSliderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (switcherWidth - 8) / 2)],
  });

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

      {mode !== "forgot" && (
        <View style={styles.tabSwitcher} onLayout={(e) => setSwitcherWidth(e.nativeEvent.layout.width)}>
          <Animated.View
            style={[
              styles.tabSlider,
              { width: Math.max(0, (switcherWidth - 8) / 2), transform: [{ translateX: sliderTranslateX }] },
            ]}
          />
          <AppPressable style={styles.tab} onPress={() => switchMode("login")}>
            <Text style={[styles.tabText, { color: mode === "login" ? colors.onPrimary : colors.textMuted }]}>
              {t("auth.btnSignIn")}
            </Text>
          </AppPressable>
          <AppPressable style={styles.tab} onPress={() => switchMode("signup")}>
            <Text style={[styles.tabText, { color: mode === "signup" ? colors.onPrimary : colors.textMuted }]}>
              {t("auth.btnSignUp")}
            </Text>
          </AppPressable>
        </View>
      )}

      <Animated.View style={{ opacity: contentOpacity }}>


      <View style={[styles.fieldWrap, (showEmailRequiredError || showEmailInvalidError) ? styles.fieldWrapError : null]}>
        <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
        <TextInput
          ref={emailInputRef}
          style={styles.input}
          placeholder={t("auth.placeholderEmail")}
          placeholderTextColor={ph}
          autoComplete="email"
          textContentType="emailAddress"
          importantForAutofill="yes"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          onFocus={() => onInputFocus(emailInputRef)}
          onBlur={() => {
            setEmailTouched(true);
            if (activeInputRef.current === emailInputRef.current) activeInputRef.current = null;
          }}
        />
      </View>
      {showEmailRequiredError ? <Text style={styles.inlineError}>{t("auth.inlineEmailRequired")}</Text> : null}
      {showEmailInvalidError ? <Text style={styles.inlineError}>{t("auth.inlineEmailInvalid")}</Text> : null}
      {mode !== "forgot" && (
        <>
          <View style={[styles.fieldWrap, showPasswordPolicyError ? styles.fieldWrapError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              key={`password-${mode}`}
              ref={passwordInputRef}
              style={styles.input}
              placeholder={t("auth.placeholderPassword")}
              placeholderTextColor={ph}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              textContentType={mode === "signup" ? "newPassword" : "password"}
              importantForAutofill="yes"
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
          {mode === "signup" && passwordTouched && password.length > 0 ? (
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
                  name={hasLetterAndDigit ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasLetterAndDigit ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[styles.passwordRuleText, hasLetterAndDigit ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleLetterAndDigit")}
                </Text>
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* Forgot link (login) and terms (signup) share the same container so switching tabs causes no layout shift */}
      {mode !== "forgot" && (
        <View style={{ position: "relative" }}>
          <View
            pointerEvents={mode === "signup" ? "auto" : "none"}
            style={{ opacity: mode === "signup" ? 1 : 0 }}
          >
            <AppPressable
              style={[
                styles.termsRow,
                termsError && !termsAccepted
                  ? { borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: 8 }
                  : null,
              ]}
              onPress={() => {
                setTermsAccepted((v) => !v);
                setTermsError(false);
              }}
            >
              <Ionicons
                name={termsAccepted ? "checkbox" : "square-outline"}
                size={22}
                color={termsError && !termsAccepted ? colors.danger : termsAccepted ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.termsText, { color: colors.textMuted }]}>
                {t("legal.acceptTermsPrefix")}{" "}
                <Text style={{ color: colors.primary }} onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}>
                  {t("legal.terms")}
                </Text>{" "}
                {t("legal.acceptTermsAnd")}{" "}
                <Text style={{ color: colors.primary }} onPress={() => void WebBrowser.openBrowserAsync(COMMUNITY_GUIDELINES_URL)}>
                  {t("legal.communityGuidelines")}
                </Text>
              </Text>
            </AppPressable>
          </View>
          <View
            style={{ position: "absolute", top: 0, bottom: 0, right: 0, justifyContent: "center", opacity: mode === "login" ? 1 : 0 }}
            pointerEvents={mode === "login" ? "auto" : "none"}
          >
            <AppPressable onPress={() => setMode("forgot")}>
              <Text style={styles.smallLinkText}>{t("auth.forgotPassword")}</Text>
            </AppPressable>
          </View>
        </View>
      )}

        <AppPressable
          style={[styles.primary, showSubmitLoading && styles.primaryDisabled]}
          onPress={() => void submit()}
          disabled={showSubmitLoading}
          accessibilityState={{ disabled: showSubmitLoading, busy: showSubmitLoading }}
        >
          {showSubmitLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.primaryText, mode !== "login" && { position: "absolute", opacity: 0 }]}>
                {t("auth.btnSignIn")}
              </Text>
              <Text style={[styles.primaryText, mode !== "signup" && { position: "absolute", opacity: 0 }]}>
                {t("auth.btnSignUp")}
              </Text>
              <Text style={[styles.primaryText, mode !== "forgot" && { position: "absolute", opacity: 0 }]}>
                {t("auth.btnSendReset")}
              </Text>
            </View>
          )}
        </AppPressable>

        {mode === "forgot" && (
          <AppPressable style={styles.smallLink} onPress={() => setMode("login")}>
            <Text style={styles.smallLinkText}>{t("auth.backToSignIn")}</Text>
          </AppPressable>
        )}
      </Animated.View>

      {mode !== "forgot" && (
        <>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t("auth.orEmail")}</Text>
            <View style={styles.orLine} />
          </View>
          <AppPressable style={styles.outline} onPress={() => void social("google")} disabled={showSubmitLoading}>
            <FontAwesome name="google" size={18} color="#EA4335" />
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
    </ScrollView>
  );
}
