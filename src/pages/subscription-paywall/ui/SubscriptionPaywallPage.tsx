import { useEffect, useMemo } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useSubscription } from "@/entities/subscription";
import { useEntitlement } from "@/entities/subscription";
import { env } from "@/shared/lib/env";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useSubscriptionPaywallStyles } from "./subscriptionPaywallStyles";

const APPLE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions";

export default function SubscriptionPaywallScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { iapSupported, products, productsLoading, purchase, restore, purchasePending, restorePending } = useSubscription();
  const { isActive } = useEntitlement();

  useEffect(() => {
    // Keep paywall open during the 7-day intro window so users can subscribe earlier.
    if (!isActive) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("AIBooking");
  }, [isActive, navigation]);

  const styles = useSubscriptionPaywallStyles(insets.top, insets.bottom);

  const monthlyProduct = products.find((product) => {
    const productRecord = product as unknown as { id?: string; productId?: string };
    return (
      productRecord.id === env.pixAiMonthlySubscriptionSku ||
      productRecord.productId === env.pixAiMonthlySubscriptionSku
    );
  });
  const monthlyPrice =
    monthlyProduct?.displayPrice ??
    (monthlyProduct?.price != null ? String(monthlyProduct.price) : undefined);

  const primaryLabel = monthlyPrice
    ? `Start Premium, ${monthlyPrice}/month`
    : "Start Premium";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} {...androidSwipeBackPanHandlers}>
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
        <Text style={styles.feature}>- Pix AI vibe matching</Text>
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
        {Platform.OS === "ios" ? (
          <Pressable style={styles.secondary} onPress={() => void Linking.openURL(APPLE_SUBSCRIPTION_URL)}>
            <Text style={styles.secondaryText}>Manage on App Store</Text>
          </Pressable>
        ) : null}
        {Platform.OS === "android" ? (
          <Pressable style={styles.secondary} onPress={() => void Linking.openURL(GOOGLE_SUBSCRIPTION_URL)}>
            <Text style={styles.secondaryText}>Manage on Google Play</Text>
          </Pressable>
        ) : null}
        <Text style={styles.legal}>Subscription terms and billing are managed by your app store account.</Text>
      </View>
    </ScrollView>
  );
}
