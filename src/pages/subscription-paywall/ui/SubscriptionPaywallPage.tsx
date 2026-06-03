import { AppPressable } from "@/shared/ui/app-pressable";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useSubscription, useEntitlement } from "@/entities/subscription";
import { useBookingAccess } from "@/features/booking-access";
import { env } from "@/shared/lib/env";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { SubscriptionPaywallTourModal, usePaywallTourAutoOpen } from "@/features/subscription-paywall-tour";
import { useSubscriptionPaywallStyles } from "./subscriptionPaywallStyles";

const APPLE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions";

type PaywallRoute = RouteProp<BrowseFlowParamList, "SubscriptionPaywall">;

export default function SubscriptionPaywallScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const route = useRoute<PaywallRoute>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useDisableGestureDuringTransition();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { iapSupported, products, productsLoading, purchase, restore, purchasePending, restorePending } =
    useSubscription();
  const { isActive } = useEntitlement();
  const { balance, isIntroActive, introPeriodEndsAt } = useBookingAccess();
  const [selectedSku, setSelectedSku] = useState(env.pixAiMonthlySubscriptionSku);
  const { tourVisible, openTour, closeTour } = usePaywallTourAutoOpen();

  const paywallReason = route.params?.reason;

  useEffect(() => {
    if (!isActive) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("AIBooking");
  }, [isActive, navigation]);

  const styles = useSubscriptionPaywallStyles(insets.top, insets.bottom);

  const monthlyProduct = products.find((product) => product.id === env.pixAiMonthlySubscriptionSku);
  const annualProduct = products.find((product) => product.id === env.pixAiAnnualSubscriptionSku);

  const formatPrice = (product: (typeof products)[number] | undefined, fallback: string) =>
    product?.displayPrice ?? (product?.price != null ? String(product.price) : fallback);

  const monthlyPrice = formatPrice(monthlyProduct, "");
  const annualPrice = formatPrice(annualProduct, "");

  const purchaseLabel =
    selectedSku === env.pixAiAnnualSubscriptionSku
      ? annualPrice
        ? t("subscriptionPaywall.ctaAnnual", { price: annualPrice })
        : t("subscriptionPaywall.ctaAnnualFallback")
      : monthlyPrice
        ? t("subscriptionPaywall.ctaMonthly", { price: monthlyPrice })
        : t("subscriptionPaywall.ctaMonthlyFallback");

  const subtitle =
    paywallReason === "no_credits"
      ? t("subscriptionPaywall.subtitleNoCredits")
      : t("subscriptionPaywall.subtitleUpgrade");

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} {...androidSwipeBackPanHandlers}>
        <View style={styles.card}>
          <AppPressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </AppPressable>
          <Text style={styles.title}>{t("subscriptionPaywall.title")}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <BookingCreditsBadge balance={balance} isIntroActive={isIntroActive} introPeriodEndsAt={introPeriodEndsAt} />
          <AppPressable accessibilityRole="button" onPress={openTour} style={styles.tourLink}>
            <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.tourLinkText, { color: colors.primary }]}>{t("subscriptionPaywall.tour.rewatch")}</Text>
          </AppPressable>
        </View>

      <AppPressable
        style={[styles.card, selectedSku === env.pixAiMonthlySubscriptionSku && { borderColor: colors.primary, borderWidth: 2 }]}
        onPress={() => setSelectedSku(env.pixAiMonthlySubscriptionSku)}
      >
        <Text style={styles.plan}>{t("subscriptionPaywall.monthlyTitle")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.monthlyCredits")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.featureAiBooking")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.featureVibeMatch")}</Text>
        {monthlyPrice ? <Text style={styles.subtitle}>{monthlyPrice}{t("subscriptionPaywall.perMonth")}</Text> : null}
      </AppPressable>

      <AppPressable
        style={[styles.card, selectedSku === env.pixAiAnnualSubscriptionSku && { borderColor: colors.primary, borderWidth: 2 }]}
        onPress={() => setSelectedSku(env.pixAiAnnualSubscriptionSku)}
      >
        <Text style={styles.plan}>{t("subscriptionPaywall.annualTitle")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.annualCredits")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.featureAiBooking")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.featureVibeMatch")}</Text>
        <Text style={styles.feature}>{t("subscriptionPaywall.featurePostBoost")}</Text>
        {annualPrice ? <Text style={styles.subtitle}>{annualPrice}{t("subscriptionPaywall.perYear")}</Text> : null}
      </AppPressable>

      <View style={styles.card}>
        {!iapSupported ? (
          <Text style={styles.subtitle}>{t("subscriptionPaywall.expoGoHint")}</Text>
        ) : null}
        <AppPressable
          disabled={!iapSupported || purchasePending || productsLoading}
          style={styles.cta}
          onPress={() => void purchase(selectedSku)}
        >
          {purchasePending || productsLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>{purchaseLabel}</Text>
          )}
        </AppPressable>
        <AppPressable disabled={!iapSupported || restorePending} style={styles.secondary} onPress={() => void restore()}>
          {restorePending ? <ActivityIndicator color={colors.text} /> : <Text style={styles.secondaryText}>{t("subscriptionPaywall.restore")}</Text>}
        </AppPressable>
        {Platform.OS === "ios" ? (
          <AppPressable style={styles.secondary} onPress={() => void Linking.openURL(APPLE_SUBSCRIPTION_URL)}>
            <Text style={styles.secondaryText}>{t("subscriptionPaywall.manageApple")}</Text>
          </AppPressable>
        ) : null}
        {Platform.OS === "android" ? (
          <AppPressable style={styles.secondary} onPress={() => void Linking.openURL(GOOGLE_SUBSCRIPTION_URL)}>
            <Text style={styles.secondaryText}>{t("subscriptionPaywall.manageGoogle")}</Text>
          </AppPressable>
        ) : null}
        <Text style={styles.legal}>{t("subscriptionPaywall.legal")}</Text>
      </View>
      </ScrollView>
      <SubscriptionPaywallTourModal visible={tourVisible} onClose={closeTour} />
    </>
  );
}
