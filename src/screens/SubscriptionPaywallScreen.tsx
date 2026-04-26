import { useEffect, useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useEntitlement } from "@/hooks/useEntitlement";

const APPLE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions";

export default function SubscriptionPaywallScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { iapSupported, products, productsLoading, purchase, restore, purchasePending, restorePending } = useSubscription();
  const { isActive } = useEntitlement();

  useEffect(() => {
    if (!isActive) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("AIBooking");
  }, [isActive, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { paddingHorizontal: 16, paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(24, insets.bottom) },
        card: {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 14,
          gap: 10,
          marginBottom: 12,
        },
        title: { color: colors.text, fontSize: 24, fontWeight: "800" },
        subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
        plan: { color: colors.text, fontWeight: "700", fontSize: 16 },
        feature: { color: colors.text, fontSize: 14 },
        cta: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
        },
        ctaText: { color: colors.onPrimary, fontWeight: "700" },
        secondary: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        secondaryText: { color: colors.text, fontWeight: "700" },
        legal: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 6 },
      }),
    [colors, insets.bottom, insets.top],
  );

  const primaryLabel = products[0]?.displayPrice
    ? `Start 7-day free trial, then ${products[0].displayPrice}/month`
    : "Start 7-day free trial";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Unlock Pix AI Booking</Text>
        <Text style={styles.subtitle}>
          Start a 7-day free trial with monthly auto-renewal. Cancel anytime from App Store or Google Play.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.plan}>PixAI Premium Monthly</Text>
        <Text style={styles.feature}>- Pix AI smart booking access</Text>
        <Text style={styles.feature}>- 7-day free trial for eligible accounts</Text>
        <Text style={styles.feature}>- Auto-renewing subscription</Text>
      </View>

      <View style={styles.card}>
        {!iapSupported ? (
          <Text style={styles.subtitle}>
            In-app purchases are unavailable in Expo Go. Use a development build (`expo run:ios` / `expo run:android`)
            or production build to subscribe.
          </Text>
        ) : null}
        <Pressable disabled={!iapSupported || purchasePending || productsLoading} style={styles.cta} onPress={() => void purchase()}>
          {purchasePending || productsLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>{primaryLabel}</Text>
          )}
        </Pressable>
        <Pressable disabled={!iapSupported || restorePending} style={styles.secondary} onPress={() => void restore()}>
          {restorePending ? <ActivityIndicator color={colors.text} /> : <Text style={styles.secondaryText}>Restore purchases</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void Linking.openURL(APPLE_SUBSCRIPTION_URL)}>
          <Text style={styles.secondaryText}>Manage on App Store</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void Linking.openURL(GOOGLE_SUBSCRIPTION_URL)}>
          <Text style={styles.secondaryText}>Manage on Google Play</Text>
        </Pressable>
        <Text style={styles.legal}>Subscription terms and billing are managed by your app store account.</Text>
      </View>
    </ScrollView>
  );
}
