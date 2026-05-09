import { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/shared/api/supabase/client";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import type { HomeStackParamList, RootTabParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import Toast from "react-native-toast-message";

const CALLBACK_TIMEOUT_MS = 15000;

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type RootNav = NativeStackNavigationProp<RootTabParamList>;

function pickFlowFromUrl(href: string | null): "verify" | "recovery" {
  if (!href) return "verify";
  const parsed = Linking.parse(href);
  const query = parsed.queryParams ?? {};
  const flowValue = typeof query.flow === "string" ? query.flow : Array.isArray(query.flow) ? query.flow[0] : "";
  const typeValue = typeof query.type === "string" ? query.type : Array.isArray(query.type) ? query.type[0] : "";
  const raw = `${flowValue}`.toLowerCase() || `${typeValue}`.toLowerCase();
  return raw === "recovery" ? "recovery" : "verify";
}

export default function OAuthCallbackScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();
  const finished = useRef(false);

  useEffect(() => {
    const debugLog = (...args: unknown[]) => {
      if (!__DEV__) return;
      console.info("[OAuthCallback]", ...args);
    };

    const openHome = () => {
      if (finished.current) return;
      finished.current = true;
      debugLog("Navigating to HomeMain.");
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
    };

    const openProfileMain = () => {
      if (finished.current) return;
      finished.current = true;
      const root = navigation.getParent<RootNav>();
      debugLog("Navigating to ProfileMain (verified session).");
      root?.navigate("Profile", { screen: "ProfileMain" });
    };

    const openResetPassword = () => {
      if (finished.current) return;
      finished.current = true;
      debugLog("Navigating to ResetPassword.");
      navigation.getParent()?.navigate("Profile", { screen: "ResetPassword" });
    };

    const openLoginFallback = () => {
      if (finished.current) return;
      finished.current = true;
      debugLog("Invalid/expired session. Navigating to Auth.");
      navigation.getParent()?.navigate("Profile", { screen: "Auth" });
      Toast.show({
        type: "error",
        text1: "Session invalid",
        text2: "Verification link is invalid or expired. Please sign in.",
      });
    };

    const getVerifiedUserId = async () => {
      debugLog("Checking current session...");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        debugLog("No valid session found.");
        return null;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!data.user || error) {
        debugLog("getUser failed:", error?.message ?? "user is null");
        return null;
      }
      debugLog("Valid session for user:", data.user.id);
      return data.user.id;
    };

    const markProfileAsVerified = async (userId: string) => {
      debugLog("Updating verification flags for user:", userId);
      const profileResult = await supabase.from("profiles").update({ is_verified: true }).eq("id", userId);
      if (profileResult.error) {
        debugLog("profiles update failed:", profileResult.error.message);
      } else {
        debugLog("profiles update success");
      }
      return !profileResult.error;
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    let unsubscribe = () => {};
    let linkSub: { remove: () => void } | undefined;

    const { data } = supabase.auth.onAuthStateChange(() => undefined);
    unsubscribe = () => data.subscription.unsubscribe();

    timeoutId = setTimeout(() => openLoginFallback(), CALLBACK_TIMEOUT_MS);

    const run = async (href: string | null) => {
      debugLog("Callback started. URL:", href ?? "<empty>");
      const flow = pickFlowFromUrl(href);
      debugLog("Detected flow:", flow);
      if (!href) {
        const { data } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        if (!data.session) {
          openLoginFallback();
          return;
        }
        if (flow === "recovery") {
          openResetPassword();
          return;
        }
        openProfileMain();
        return;
      }
      const completed = await completeOAuthFromCallbackUrl(href);
      debugLog("Session exchange result:", completed.ok ? "ok" : completed.message);
      clearTimeout(timeoutId);
      if (!completed.ok) {
        openLoginFallback();
        return;
      }
      if (flow === "recovery") {
        openResetPassword();
        return;
      }
      const verifiedUserId = await getVerifiedUserId();
      if (!verifiedUserId) {
        openLoginFallback();
        return;
      }
      const verified = await markProfileAsVerified(verifiedUserId);
      if (!verified) {
        openLoginFallback();
        return;
      }
      openProfileMain();
    };

    void Linking.getInitialURL().then((href) => void run(href));
    linkSub = Linking.addEventListener("url", (ev) => void run(ev.url));

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      linkSub?.remove();
    };
  }, [navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textMuted }]}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { marginTop: 12 },
});
