import { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/shared/api/supabase/client";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import type { HomeStackParamList, RootTabParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

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
    const openHome = () => {
      if (finished.current) return;
      finished.current = true;
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
    };

    const openEditProfile = () => {
      if (finished.current) return;
      finished.current = true;
      const root = navigation.getParent<RootNav>();
      root?.navigate("Profile", { screen: "EditProfile" });
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
    };

    const openResetPassword = () => {
      if (finished.current) return;
      finished.current = true;
      navigation.getParent()?.navigate("Profile", { screen: "ResetPassword" });
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
    };

    const openLoginFallback = () => {
      if (finished.current) return;
      finished.current = true;
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
      navigation.getParent()?.navigate("Profile", { screen: "Auth" });
      Alert.alert("Session invalid", "Verification link is invalid or expired. Please sign in.");
    };

    const getVerifiedUserId = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) return null;
      const { data, error } = await supabase.auth.getUser();
      if (!data.user || error) return null;
      return data.user.id;
    };

    const markProfileAsVerified = async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ is_verified: true }).eq("id", userId);
      return !error;
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    let unsubscribe = () => {};
    let linkSub: { remove: () => void } | undefined;

    const { data } = supabase.auth.onAuthStateChange(() => undefined);
    unsubscribe = () => data.subscription.unsubscribe();

    timeoutId = setTimeout(() => openLoginFallback(), CALLBACK_TIMEOUT_MS);

    const run = async (href: string | null) => {
      const flow = pickFlowFromUrl(href);
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
        openEditProfile();
        return;
      }
      const completed = await completeOAuthFromCallbackUrl(href);
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
      openEditProfile();
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
