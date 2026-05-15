import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { markProfileVerifiedAndInvalidate } from "@/entities/user";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import { waitForAuthUserId } from "@/entities/user";
import type { ProfileStackParamList, RootTabParamList } from "@/app/navigation/types";
import Toast from "react-native-toast-message";
import { devInfo } from "@/shared/lib/devLog";

const CALLBACK_TIMEOUT_MS = 20000;

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList, "AuthEmailCallback">;
type RootNav = NativeStackNavigationProp<RootTabParamList>;

function pickFlowFromUrl(href: string | null): "verify" | "recovery" {
  if (!href) return "verify";

  const hashIdx = href.indexOf("#");
  const hashPart = hashIdx >= 0 ? href.slice(hashIdx + 1) : "";
  const hashParams = new URLSearchParams(hashPart);
  const typeFromHash = `${hashParams.get("type") ?? ""}`.toLowerCase();
  if (typeFromHash === "recovery") return "recovery";

  const parsed = Linking.parse(href);
  const query = parsed.queryParams ?? {};
  const flowValue = typeof query.flow === "string" ? query.flow : Array.isArray(query.flow) ? query.flow[0] : "";
  const typeValue =
    typeof query.type === "string" ? query.type : Array.isArray(query.type) ? query.type[0] : "";

  const typeFromQuery = `${typeValue}`.toLowerCase();
  if (typeFromQuery === "recovery") return "recovery";

  const raw = `${flowValue}`.toLowerCase() || typeFromQuery;
  return raw === "recovery" ? "recovery" : "verify";
}

export default function AuthEmailCallbackPage() {
  const navigation = useNavigation<ProfileNav>();
  const route = useRoute<RouteProp<ProfileStackParamList, "AuthEmailCallback">>();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const done = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hrefFromRouteRef = useRef<string | undefined>(undefined);
  hrefFromRouteRef.current = route.params?.href?.trim();

  useEffect(() => {
    const debugLog = (...args: unknown[]) => {
      devInfo("[AuthEmailCallback]", ...args);
    };

    const clearCallbackTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const openProfileMain = () => {
      if (done.current) return;
      done.current = true;
      clearCallbackTimeout();
      const root = navigation.getParent<RootNav>();
      debugLog("Navigating to ProfileMain (valid session).");
      root?.navigate("Profile", { screen: "ProfileMain" });
      navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
    };

    const openResetPassword = () => {
      if (done.current) return;
      done.current = true;
      clearCallbackTimeout();
      const root = navigation.getParent<RootNav>();
      debugLog("Navigating to ResetPassword (recovery).");
      root?.navigate("Profile", { screen: "ResetPassword" });
      navigation.reset({ index: 0, routes: [{ name: "ResetPassword" }] });
    };

    const openInvalidSessionFallback = () => {
      if (done.current) return;
      done.current = true;
      clearCallbackTimeout();
      debugLog("Invalid session. Navigating to Auth.");
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
      Toast.show({
        type: "error",
        text1: "Session invalid",
        text2: "Verification link is invalid or expired. Please sign in again.",
      });
    };

    const markProfileAsVerified = async (userId: string) => {
      debugLog("Updating profiles.is_verified for user:", userId);
      const ok = await markProfileVerifiedAndInvalidate(queryClient, userId);
      if (!ok) {
        debugLog("profiles update failed or no row returned.");
        return false;
      }
      debugLog("profiles update success for user:", userId);
      return true;
    };

    const run = async (href: string | null) => {
      if (done.current) return;
      debugLog("Callback started. URL:", href ?? "<empty>");
      const flow = pickFlowFromUrl(href);
      debugLog("Detected flow:", flow);
      const completed = await completeOAuthFromCallbackUrl(href);
      debugLog("Session exchange result:", completed.ok ? "ok" : completed.message);
      if (!completed.ok) {
        openInvalidSessionFallback();
        return;
      }
      if (flow === "recovery") {
        debugLog("Recovery flow: waiting for authenticated user after callback.");
        const recoveryUserId = await waitForAuthUserId();
        if (!recoveryUserId) {
          debugLog("Recovery flow: no authenticated user, fallback to Auth.");
          openInvalidSessionFallback();
          return;
        }
        debugLog("Recovery flow: authenticated user resolved:", recoveryUserId);
        openResetPassword();
        return;
      }
      const verifiedUserId = await waitForAuthUserId();
      if (!verifiedUserId) {
        debugLog("No user id after session exchange.");
        openInvalidSessionFallback();
        return;
      }
      const verified = await markProfileAsVerified(verifiedUserId);
      if (!verified) {
        Toast.show({
          type: "error",
          text1: "Verification",
          text2: "Signed in but could not update verified status. Try again from Profile.",
        });
        openProfileMain();
        return;
      }
      openProfileMain();
    };

    timeoutRef.current = setTimeout(() => openInvalidSessionFallback(), CALLBACK_TIMEOUT_MS);

    const resolveInitialHref = async (routeHref: string | undefined) => {
      const trimmed = routeHref?.trim();
      if (trimmed) return trimmed;
      for (let i = 0; i < 6; i += 1) {
        const url = await Linking.getInitialURL();
        if (url) return url;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    };

    void (async () => {
      const resolved = await resolveInitialHref(hrefFromRouteRef.current);
      await run(resolved);
    })();

    const sub = Linking.addEventListener("url", (event) => void run(event.url));

    return () => {
      clearCallbackTimeout();
      sub?.remove();
    };
  }, [navigation, queryClient]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textMuted }]}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { marginTop: 12 },
});
