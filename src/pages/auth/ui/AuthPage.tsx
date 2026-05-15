import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
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
import { env } from "@/shared/lib/env";
import { getOAuthRedirectUri } from "@/shared/lib/oauthRedirect";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import {
  AUTH_PRIMARY_COLOR,
  SHARED_PRESSABLE_HEIGHT,
  SHARED_PRESSABLE_RADIUS,
  primaryPressableStyle,
  primaryPressableTextStyle,
} from "@/shared/theme/primaryPressable";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
        content: { flexGrow: 1, justifyContent: "center" },
        title: { fontSize: 36, fontWeight: "800", marginBottom: 6, color: colors.text, lineHeight: 54 },
        helper: { fontSize: 14, color: colors.textMuted, marginBottom: 26, lineHeight: 30 },
        fieldWrap: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          marginBottom: 12,
          backgroundColor: colors.card,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          minHeight: 58,
        },
        fieldWrapError: {
          borderColor: "#ec6544",
        },
        fieldIcon: { marginRight: 10 },
        input: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          paddingVertical: 12,
        },
        primary: {
          ...primaryPressableStyle,
          marginTop: 14,
        },
        primaryText: primaryPressableTextStyle,
        smallLink: { marginTop: 10, alignSelf: "flex-start" },
        smallLinkText: { color: AUTH_PRIMARY_COLOR, fontSize: 14, fontWeight: "500" },
        orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
        orLine: { flex: 1, height: 1, backgroundColor: colors.border },
        orText: { color: colors.textMuted, fontSize: 14, paddingHorizontal: 6 },
        outline: {
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: SHARED_PRESSABLE_HEIGHT,
          borderRadius: SHARED_PRESSABLE_RADIUS,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
          backgroundColor: colors.background,
          flexDirection: "row",
          gap: 10,
        },
        outlineText: { color: colors.text, fontWeight: "700", fontSize: 14 },
        bottomSwitch: { marginTop: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
        bottomSwitchText: { color: colors.textMuted, fontSize: 14 },
        bottomSwitchLink: { color: AUTH_PRIMARY_COLOR, fontSize: 14, fontWeight: "700" },
        inlineError: { marginTop: -4, marginBottom: 10, color: colors.danger, fontSize: 12 },
        passwordRules: { marginTop: -2, marginBottom: 8, gap: 4 },
        passwordRuleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        passwordRuleText: { fontSize: 14, color: colors.textMuted },
      }),
    [colors],
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

  useEffect(() => {
    if (!authLoading && user) {
      navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
    }
  }, [authLoading, user, navigation]);

  const social = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const isExpoGo = Constants.appOwnership === "expo";
      if (__DEV__) {
        console.info("[Auth][social] provider:", provider, "platform:", Platform.OS, "expoGo:", isExpoGo);
      }
      if (provider === "apple" && Platform.OS === "ios" && !isExpoGo) {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (__DEV__) {
          console.info("[Apple][native] available:", isAvailable);
        }
        if (!isAvailable) {
          Alert.alert(t("auth.alerts.appleUnavailableTitle"), t("auth.alerts.appleUnavailableBody"));
          return;
        }

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        const token = credential.identityToken;
        if (__DEV__) {
          console.info("[Apple][native] token received:", Boolean(token), "user:", credential.user ?? "n/a");
        }
        if (!token) {
          Alert.alert(t("auth.alerts.signInFailed"), t("auth.alerts.appleNoToken"));
          return;
        }

        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token,
        });
        if (error) {
          if (__DEV__) {
            console.error("[Apple][native] signInWithIdToken error:", error.message);
          }
          Alert.alert(t("auth.alerts.signInFailed"), error.message);
          return;
        }
        if (__DEV__) {
          console.info("[Apple][native] signInWithIdToken success");
        }
        return;
      }

      if (__DEV__) {
        try {
          console.info("[OAuth] Supabase host:", new URL(env.supabaseUrl).hostname);
        } catch {
          /* ignore */
        }
      }
      const redirectTo = getOAuthRedirectUri();
      if (__DEV__) {
        console.info("[OAuth] redirectTo:", redirectTo, "provider:", provider);
      }
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
      if (__DEV__) {
        console.info("[OAuth] auth URL generated:", data.url.slice(0, 140));
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (__DEV__) {
        console.info("[OAuth] openAuthSession result:", result.type);
      }
      if (result.type === "success" && result.url) {
        if (__DEV__) {
          console.info("[OAuth] callback URL:", result.url);
        }
        const finished = await completeOAuthFromCallbackUrl(result.url);
        if (__DEV__) {
          if (finished.ok) console.info("[OAuth] callback exchange: success");
          else console.error("[OAuth] callback exchange: failed:", finished.message);
        }
        if (!finished.ok) {
          Alert.alert(t("auth.alerts.signInFailed"), finished.message);
          return;
        }
        return;
      }
      if (result.type !== "success") {
        Alert.alert(t("auth.alerts.signInCancelled"));
      }
    } catch (e: unknown) {
      Alert.alert(t("auth.alerts.oauthError"), e instanceof Error ? e.message : t("auth.alerts.unknown"));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert(t("auth.alerts.signInFailed"), error);
          return;
        }
        return;
      }
      if (mode === "signup") {
        setEmailTouched(true);
        setPasswordTouched(true);
        setConfirmPasswordTouched(true);
        if (isEmailEmpty) {
          Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.emailRequired"));
          return;
        }
        if (!isValidEmail(email)) {
          Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.emailInvalid"));
          return;
        }
        if (!isPasswordPolicyValid) {
          Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.passwordPolicy"));
          return;
        }
        if (!arePasswordsMatching) {
          Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.passwordsMismatch"));
          return;
        }
        const { error, isUserAlreadyExists } = await signUp(email, password, firstName, lastName);
        if (error) {
          if (isUserAlreadyExists) {
            Alert.alert(t("auth.alerts.emailAlreadyRegisteredTitle"), t("auth.alerts.emailAlreadyRegisteredBody"));
            return;
          }
          Alert.alert(t("auth.alerts.signUpFailed"), error);
          return;
        }
        const signInResult = await signIn(email, password);
        if (signInResult.error) {
          Alert.alert(t("auth.alerts.signUpAutoSignInFailedTitle"), t("auth.alerts.signUpAutoSignInFailedBody"));
          setMode("login");
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: "EditProfile" }] });
        return;
      }
      setEmailTouched(true);
      if (isEmailEmpty) {
        Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.emailRequired"));
        return;
      }
      if (!isValidEmail(email)) {
        Alert.alert(t("auth.alerts.validationTitle"), t("auth.alerts.emailInvalid"));
        return;
      }
      navigation.navigate("VerifyEmailOtp", { flow: "recovery", email: email.trim() });
    } finally {
      setLoading(false);
    }
  };

  const ph = colors.textMuted;

  return (
    <ScrollView
      ref={scrollRef}
      style={stylesThemed.root}
      contentContainerStyle={[
        stylesThemed.content,
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
      <Text style={stylesThemed.title}>
        {mode === "login" ? t("auth.titleLogin") : mode === "signup" ? t("auth.titleSignup") : t("auth.titleForgot")}
      </Text>
      <Text style={stylesThemed.helper}>
        {mode === "forgot" ? t("auth.helperForgot") : t("auth.helperDefault")}
      </Text>

      {mode === "signup" && (
        <>
          <View style={stylesThemed.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
            <TextInput
              ref={firstNameInputRef}
              style={stylesThemed.input}
              placeholder={t("auth.placeholderFirstName")}
              placeholderTextColor={ph}
              value={firstName}
              onChangeText={setFirstName}
              onFocus={() => onInputFocus(firstNameInputRef)}
            />
          </View>
          <View style={stylesThemed.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
            <TextInput
              ref={lastNameInputRef}
              style={stylesThemed.input}
              placeholder={t("auth.placeholderLastName")}
              placeholderTextColor={ph}
              value={lastName}
              onChangeText={setLastName}
              onFocus={() => onInputFocus(lastNameInputRef)}
            />
          </View>
        </>
      )}

      <View style={[stylesThemed.fieldWrap, (showEmailRequiredError || showEmailInvalidError) ? stylesThemed.fieldWrapError : null]}>
        <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
        <TextInput
          ref={emailInputRef}
          style={stylesThemed.input}
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
      {showEmailRequiredError ? <Text style={stylesThemed.inlineError}>{t("auth.inlineEmailRequired")}</Text> : null}
      {showEmailInvalidError ? <Text style={stylesThemed.inlineError}>{t("auth.inlineEmailInvalid")}</Text> : null}
      {mode !== "forgot" && (
        <>
          <View style={[stylesThemed.fieldWrap, showPasswordPolicyError ? stylesThemed.fieldWrapError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
            <TextInput
              ref={passwordInputRef}
              style={stylesThemed.input}
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
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          {mode === "signup" && passwordTouched ? (
            <View style={stylesThemed.passwordRules}>
              <View style={stylesThemed.passwordRuleRow}>
                <Ionicons
                  name={hasMinPasswordLength ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasMinPasswordLength ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[stylesThemed.passwordRuleText, hasMinPasswordLength ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleMinLength")}
                </Text>
              </View>
              <View style={stylesThemed.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordUppercase ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordUppercase ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[stylesThemed.passwordRuleText, hasPasswordUppercase ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleUppercase")}
                </Text>
              </View>
              <View style={stylesThemed.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordDigit ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordDigit ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[stylesThemed.passwordRuleText, hasPasswordDigit ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleDigit")}
                </Text>
              </View>
              
              <View style={stylesThemed.passwordRuleRow}>
                <Ionicons
                  name={hasPasswordSpecial ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={16}
                  color={hasPasswordSpecial ? PASSWORD_RULE_SUCCESS_COLOR : colors.danger}
                />
                <Text style={[stylesThemed.passwordRuleText, hasPasswordSpecial ? { color: PASSWORD_RULE_SUCCESS_COLOR } : { color: colors.textMuted }]}>
                  {t("auth.ruleSpecial")}
                </Text>
              </View>
            </View>
          ) : null}
          {mode === "signup" ? (
            <>
              <View style={[stylesThemed.fieldWrap, showPasswordsMismatch ? stylesThemed.fieldWrapError : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
                <TextInput
                  ref={confirmPasswordInputRef}
                  style={stylesThemed.input}
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
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
                  <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {showPasswordsMismatch ? <Text style={stylesThemed.inlineError}>{t("auth.inlinePasswordsMismatch")}</Text> : null}
            </>
          ) : null}
        </>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : (
        <Pressable style={stylesThemed.primary} onPress={() => void submit()}>
          <Text style={stylesThemed.primaryText}>
            {mode === "login" ? t("auth.btnSignIn") : mode === "signup" ? t("auth.btnSignUp") : t("auth.btnSendReset")}
          </Text>
        </Pressable>
      )}

      {mode === "login" ? (
        <Pressable style={stylesThemed.smallLink} onPress={() => setMode("forgot")}>
          <Text style={stylesThemed.smallLinkText}>{t("auth.forgotPassword")}</Text>
        </Pressable>
      ) : null}
      {mode === "forgot" ? (
        <Pressable style={stylesThemed.smallLink} onPress={() => setMode("login")}>
          <Text style={stylesThemed.smallLinkText}>{t("auth.backToSignIn")}</Text>
        </Pressable>
      ) : null}

      {mode !== "forgot" && (
        <>
          <View style={stylesThemed.orRow}>
            <View style={stylesThemed.orLine} />
            <Text style={stylesThemed.orText}>{t("auth.or")}</Text>
            <View style={stylesThemed.orLine} />
          </View>
          <Pressable style={stylesThemed.outline} onPress={() => void social("google")} disabled={loading}>
            <FontAwesome name="google" size={18} color="#ec6544" />
            <Text style={stylesThemed.outlineText}>{t("auth.continueGoogle")}</Text>
          </Pressable>
          {Platform.OS !== "android" ? (
            <Pressable style={stylesThemed.outline} onPress={() => void social("apple")} disabled={loading}>
              <FontAwesome6 name="apple" size={18} color={themeMode === "dark" ? "#fff" : "#ec6544"} />
              <Text style={stylesThemed.outlineText}>{t("auth.continueApple")}</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {mode === "login" ? (
        <Pressable style={stylesThemed.bottomSwitch} onPress={() => setMode("signup")}>
          <Text style={stylesThemed.bottomSwitchText}>{t("auth.noAccount")}</Text>
          <Text style={stylesThemed.bottomSwitchLink}>{t("auth.signUpLink")}</Text>
        </Pressable>
      ) : null}
      {mode === "signup" ? (
        <Pressable style={stylesThemed.bottomSwitch} onPress={() => setMode("login")}>
          <Text style={stylesThemed.bottomSwitchText}>{t("auth.haveAccount")}</Text>
          <Text style={stylesThemed.bottomSwitchLink}>{t("auth.signInLink")}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
