import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "@/contexts/ThemeContext";
import { completeOAuthFromCallbackUrl } from "@/shared/lib/completeOAuthSession";
import type { ProfileStackParamList, RootTabParamList } from "@/navigation/types";

const CALLBACK_TIMEOUT_MS = 15000;

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList, "AuthEmailCallback">;
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

export default function AuthEmailCallbackPage() {
  const navigation = useNavigation<ProfileNav>();
  const { colors } = useAppTheme();
  const done = useRef(false);

  useEffect(() => {
    const openHome = () => {
      if (done.current) return;
      done.current = true;
      const root = navigation.getParent<RootNav>();
      root?.navigate("Home", { screen: "HomeMain" });
      navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
    };

    const openResetPassword = () => {
      if (done.current) return;
      done.current = true;
      navigation.reset({ index: 0, routes: [{ name: "ResetPassword" }] });
    };

    const openFallback = () => {
      if (done.current) return;
      done.current = true;
      openHome();
    };

    const run = async (href: string | null) => {
      const flow = pickFlowFromUrl(href);
      const completed = await completeOAuthFromCallbackUrl(href);
      if (!completed.ok) {
        openFallback();
        return;
      }
      if (flow === "recovery") {
        openResetPassword();
        return;
      }
      openHome();
    };

    const timeoutId = setTimeout(() => openFallback(), CALLBACK_TIMEOUT_MS);
    void Linking.getInitialURL().then((url) => void run(url));
    const sub = Linking.addEventListener("url", (event) => void run(event.url));

    return () => {
      clearTimeout(timeoutId);
      sub?.remove();
    };
  }, [navigation]);

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
