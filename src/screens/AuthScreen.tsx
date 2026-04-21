import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons, FontAwesome, FontAwesome6 } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { completeOAuthFromCallbackUrl } from "@/lib/completeOAuthSession";
import { env } from "@/lib/env";
import { getOAuthRedirectUri } from "@/lib/oauthRedirect";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

WebBrowser.maybeCompleteAuthSession();

type Mode = "login" | "signup" | "forgot";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Auth">;

export default function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, loading: authLoading, signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        fieldIcon: { marginRight: 10 },
        input: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          paddingVertical: 12,
        },
        primary: {
          backgroundColor: "#ec6544",
          paddingVertical: 16,
          borderRadius: 18,
          alignItems: "center",
          marginTop: 14,
        },
        primaryText: { color: "#fff", fontWeight: "700", fontSize: 16, lineHeight: 32 },
        smallLink: { marginTop: 10, alignSelf: "flex-start" },
        smallLinkText: { color: "#ec6544", fontSize: 14, fontWeight: "500" },
        orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
        orLine: { flex: 1, height: 1, backgroundColor: colors.border },
        orText: { color: colors.textMuted, fontSize: 14, paddingHorizontal: 6 },
        outline: {
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 14,
          borderRadius: 18,
          alignItems: "center",
          marginBottom: 10,
          backgroundColor: colors.background,
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
        },
        outlineText: { color: colors.text, fontWeight: "700", fontSize: 14 },
        bottomSwitch: { marginTop: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
        bottomSwitchText: { color: colors.textMuted, fontSize: 14 },
        bottomSwitchLink: { color: "#ec6544", fontSize: 14, fontWeight: "700" },
      }),
    [colors],
  );

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
          Alert.alert("Apple Sign-In unavailable", "Apple Sign-In is not available on this device.");
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
          Alert.alert("Sign in failed", "Apple did not return an identity token.");
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
          Alert.alert("Sign in failed", error.message);
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
          Alert.alert("Sign in failed", finished.message);
          return;
        }
        return;
      }
      if (result.type !== "success") {
        Alert.alert("Sign in cancelled or failed");
      }
    } catch (e: unknown) {
      Alert.alert("OAuth error", e instanceof Error ? e.message : "Unknown");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "login") {
        const { error, isUnverified } = await signIn(email, password);
        if (isUnverified) {
          Alert.alert("Verify email", "Check your inbox to verify before signing in.");
          return;
        }
        if (error) {
          Alert.alert("Sign in failed", error);
          return;
        }
        return;
      }
      if (mode === "signup") {
        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          Alert.alert("Sign up failed", error);
          return;
        }
        Alert.alert("Check your email", "We sent a verification link.");
        setMode("login");
        return;
      }
      const { error } = await resetPassword(email);
      if (error) Alert.alert("Error", error);
      else Alert.alert("Sent", "Check your email for a reset link.");
    } finally {
      setLoading(false);
    }
  };

  const ph = colors.textMuted;

  return (
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={{
        ...stylesThemed.content,
        paddingTop: Math.max(insets.top, 22),
        paddingBottom: Math.max(insets.bottom, 48),
      }}
    >
      <Text style={stylesThemed.title}>
        {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
      </Text>
      <Text style={stylesThemed.helper}>
        {mode === "forgot" ? "Enter your email for reset link" : "Sign in to continue"}
      </Text>

      {mode === "signup" && (
        <>
          <View style={stylesThemed.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
            <TextInput
              style={stylesThemed.input}
              placeholder="First name"
              placeholderTextColor={ph}
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>
          <View style={stylesThemed.fieldWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
            <TextInput
              style={stylesThemed.input}
              placeholder="Last name"
              placeholderTextColor={ph}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </>
      )}

      <View style={stylesThemed.fieldWrap}>
        <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
        <TextInput
          style={stylesThemed.input}
          placeholder="Email address"
          placeholderTextColor={ph}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      {mode !== "forgot" && (
        <View style={stylesThemed.fieldWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={stylesThemed.fieldIcon} />
          <TextInput
            style={stylesThemed.input}
            placeholder="Password"
            placeholderTextColor={ph}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : (
        <Pressable style={stylesThemed.primary} onPress={() => void submit()}>
          <Text style={stylesThemed.primaryText}>
            {mode === "login" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
          </Text>
        </Pressable>
      )}

      {mode === "login" ? (
        <Pressable style={stylesThemed.smallLink} onPress={() => setMode("forgot")}>
          <Text style={stylesThemed.smallLinkText}>Forgot password?</Text>
        </Pressable>
      ) : null}
      {mode === "forgot" ? (
        <Pressable style={stylesThemed.smallLink} onPress={() => setMode("login")}>
          <Text style={stylesThemed.smallLinkText}>Back to sign in</Text>
        </Pressable>
      ) : null}

      {mode !== "forgot" && (
        <>
          <View style={stylesThemed.orRow}>
            <View style={stylesThemed.orLine} />
            <Text style={stylesThemed.orText}>or</Text>
            <View style={stylesThemed.orLine} />
          </View>
          <Pressable style={stylesThemed.outline} onPress={() => void social("google")} disabled={loading}>
            <FontAwesome name="google" size={18} color="#4285F4" />
            <Text style={stylesThemed.outlineText}>Continue with Google</Text>
          </Pressable>
          <Pressable style={stylesThemed.outline} onPress={() => void social("apple")} disabled={loading}>
            <FontAwesome6 name="apple" size={18} color="#fff" />
            <Text style={stylesThemed.outlineText}>Continue with Apple</Text>
          </Pressable>
        </>
      )}

      {mode === "login" ? (
        <Pressable style={stylesThemed.bottomSwitch} onPress={() => setMode("signup")}>
          <Text style={stylesThemed.bottomSwitchText}>Don&apos;t have an account?</Text>
          <Text style={stylesThemed.bottomSwitchLink}>Sign Up</Text>
        </Pressable>
      ) : null}
      {mode === "signup" ? (
        <Pressable style={stylesThemed.bottomSwitch} onPress={() => setMode("login")}>
          <Text style={stylesThemed.bottomSwitchText}>Already have an account?</Text>
          <Text style={stylesThemed.bottomSwitchLink}>Sign In</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
