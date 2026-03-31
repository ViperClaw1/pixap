import { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/integrations/supabase/client";
import { completeOAuthFromCallbackUrl } from "@/lib/completeOAuthSession";
import type { HomeStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

const CALLBACK_TIMEOUT_MS = 15000;

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export default function OAuthCallbackScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();
  const finished = useRef(false);

  useEffect(() => {
    const finishSuccess = () => {
      if (finished.current) return;
      finished.current = true;
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
    };

    const finishFailure = () => {
      if (finished.current) return;
      finished.current = true;
      navigation.reset({ index: 0, routes: [{ name: "HomeMain" }] });
      navigation.getParent()?.navigate("Profile", { screen: "Auth" });
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    let unsubscribe = () => {};
    let linkSub: { remove: () => void } | undefined;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
        finishSuccess();
      }
    });
    unsubscribe = () => data.subscription.unsubscribe();

    timeoutId = setTimeout(() => finishFailure(), CALLBACK_TIMEOUT_MS);

    const run = async (href: string | null) => {
      if (!href) {
        const { data } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        if (data.session) finishSuccess();
        else finishFailure();
        return;
      }
      const finished = await completeOAuthFromCallbackUrl(href);
      clearTimeout(timeoutId);
      if (finished.ok) finishSuccess();
      else finishFailure();
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
