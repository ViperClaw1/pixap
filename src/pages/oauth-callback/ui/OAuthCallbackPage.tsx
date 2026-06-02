import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList, RootTabParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { devInfo } from "@/shared/lib/devLog";
import { isOAuthCallbackHandled } from "@/shared/lib/oauthCallbackHandled";

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type RootNav = NativeStackNavigationProp<RootTabParamList>;

/**
 * Legacy route: deep links used to land on Home stack with `~oauth/callback`.
 * All Supabase session completion (OAuth PKCE + email verify hash tokens) is handled in Profile `AuthEmailCallback`.
 */
export default function OAuthCallbackScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();

  useEffect(() => {
    const forward = (href: string | null) => {
      if (href && isOAuthCallbackHandled(href)) {
        devInfo("[OAuthCallback] skipping forward — callback already handled in-app");
        return;
      }
      const rootNav = navigation.getParent<RootNav>();
      if (!rootNav) return;
      devInfo("[OAuthCallback] forwarding to Profile/AuthEmailCallback", href ?? "<fetch getInitialURL>");
      rootNav.navigate("Profile", {
        screen: "AuthEmailCallback",
        params: href?.trim() ? { href } : {},
      });
    };

    void Linking.getInitialURL().then(forward);
    const sub = Linking.addEventListener("url", (ev) => void forward(ev.url));
    return () => sub.remove();
  }, [navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textMuted }]}>Continuing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { marginTop: 12 },
});
