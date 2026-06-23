import { AppPressable } from "@/shared/ui/app-pressable";
import { useState, useEffect } from "react";
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useSubscription, type SubscriptionErrorCode } from "@/entities/subscription";
import { useBookingAccess } from "@/features/booking-access";
import { SubscriptionPurchaseResultModal } from "@/features/subscription-paywall-redirect";
import {
  getPixAiAnnualSubscriptionSku,
  getPixAiMonthlySubscriptionSku,
} from "@/entities/subscription/model/productIds";
import { PRIVACY_URL, TERMS_URL } from "@/shared/lib/legalUrls";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { BookingCreditsBadge } from "@/shared/ui/booking-credits-badge/BookingCreditsBadge";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { SubscriptionPaywallTourModal, usePaywallTourAutoOpen } from "@/features/subscription-paywall-tour";
import { getAnnualPlanFeatures, getMonthlyPlanFeatures } from "../lib/paywallPlanFeatures";
import { PaywallPlanCard } from "./PaywallPlanCard";
import { useSubscriptionPaywallStyles } from "./subscriptionPaywallStyles";
import { trackPaywallViewed, trackPaywallDismissed, trackPurchaseCompleted } from "@/shared/lib/analytics/track";

const APPLE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions";

type PaywallRoute = RouteProp<BrowseFlowParamList, "SubscriptionPaywall">;

function getSubscriptionErrorTranslationKey(code: SubscriptionErrorCode | undefined): string {
  switch (code) {
    case "auth_required":
      return "subscriptionPaywall.errors.authRequired";
    case "invalid_purchase":
      return "subscriptionPaywall.errors.invalidPurchase";
    case "purchase_already_linked":
      return "subscriptionPaywall.errors.purchaseAlreadyLinked";
    case "verification_unavailable":
      return "subscriptionPaywall.errors.verificationUnavailable";
    case "network_unavailable":
      return "subscriptionPaywall.errors.networkUnavailable";
    case "iap_unavailable":
      return "subscriptionPaywall.errors.iapUnavailable";
    case "missing_sku":
      return "subscriptionPaywall.errors.missingSku";
    case "no_eligible_offer":
      return "subscriptionPaywall.errors.noEligibleOffer";
    case "store_purchase_failed":
      return "subscriptionPaywall.errors.storePurchaseFailed";
    case "restore_no_purchases":
      return "subscriptionPaywall.restoreNothingToast";
    case "restore_failed":
      return "subscriptionPaywall.restoreErrorToast";
    case "verification_failed":
    default:
      return "subscriptionPaywall.purchaseErrorBody";
  }
}

export default function SubscriptionPaywallScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const route = useRoute<PaywallRoute>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useDisableGestureDuringTransition();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const {
    iapSupported,
    products,
    productsLoading,
    purchase,
    restore,
    purchasePending,
    restorePending,
    verificationState,
    verifying,
    resetVerificationState,
  } = useSubscription();
  const { balance, isIntroActive, introPeriodEndsAt, hasPaidPremium } = useBookingAccess();
  const [selectedSku, setSelectedSku] = useState(getPixAiAnnualSubscriptionSku);
  const { tourVisible, openTour, closeTour } = usePaywallTourAutoOpen();

  const paywallReason = route.params?.reason;

  useEffect(() => {
    trackPaywallViewed(paywallReason ?? "upgrade", "direct");
  }, [paywallReason]);

  useEffect(() => {
    if (verificationState.status === "success") {
      trackPurchaseCompleted(selectedSku);
    }
  }, [verificationState.status, selectedSku]);

  const styles = useSubscriptionPaywallStyles(insets.top, insets.bottom);
  const monthlyFeatures = getMonthlyPlanFeatures(t);
  const annualFeatures = getAnnualPlanFeatures(t);

  const monthlyProduct = products.find((product) => product.id === getPixAiMonthlySubscriptionSku());
  const annualProduct = products.find((product) => product.id === getPixAiAnnualSubscriptionSku());

  const formatPrice = (product: (typeof products)[number] | undefined, fallback: string) =>
    product?.displayPrice ?? (product?.price != null ? String(product.price) : fallback);

  const monthlyPrice = formatPrice(monthlyProduct, "");
  const annualPrice = formatPrice(annualProduct, "");

  const purchaseLabel =
    selectedSku === getPixAiAnnualSubscriptionSku()
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

  const handleSuccessDismiss = () => {
    resetVerificationState();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("AIBooking");
  };

  const handleErrorDismiss = () => {
    resetVerificationState();
  };

  const handlePurchase = async () => {
    try {
      await purchase(selectedSku);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "user-cancelled") return;
      const message = t(getSubscriptionErrorTranslationKey(code as SubscriptionErrorCode | undefined));
      Alert.alert(t("subscriptionPaywall.purchaseErrorTitle"), message);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "restore_no_purchases") {
        Alert.alert(t("subscriptionPaywall.restoreNothingToast"), undefined, [{ text: t("common.ok") }]);
        return;
      }
      if (code !== "user-cancelled") {
        Alert.alert(t("subscriptionPaywall.restoreErrorToast"));
      }
    }
  };

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} {...androidSwipeBackPanHandlers}>
        <View style={styles.card}>
          <AppPressable onPress={() => { trackPaywallDismissed(paywallReason ?? "upgrade"); navigation.goBack(); }} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </AppPressable>
          <Text style={styles.title}>{t("subscriptionPaywall.title")}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <BookingCreditsBadge
            balance={balance}
            isIntroActive={isIntroActive}
            hasPaidPremium={hasPaidPremium}
            introPeriodEndsAt={introPeriodEndsAt}
          />
          <AppPressable accessibilityRole="button" onPress={openTour} style={styles.tourLink}>
            <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.tourLinkText, { color: colors.primary }]}>{t("subscriptionPaywall.tour.rewatch")}</Text>
          </AppPressable>
        </View>

      <PaywallPlanCard
        title={t("subscriptionPaywall.monthlyTitle")}
        features={monthlyFeatures}
        price={monthlyPrice || undefined}
        priceSuffix={t("subscriptionPaywall.perMonth")}
        selected={selectedSku === getPixAiMonthlySubscriptionSku()}
        onPress={() => setSelectedSku(getPixAiMonthlySubscriptionSku())}
        cardStyle={styles.card}
        planStyle={styles.plan}
        subtitleStyle={styles.subtitle}
        selectedCardStyle={styles.planCardSelected}
      />

      <PaywallPlanCard
        title={t("subscriptionPaywall.annualTitle")}
        features={annualFeatures}
        price={annualPrice || undefined}
        priceSuffix={t("subscriptionPaywall.perYear")}
        selected={selectedSku === getPixAiAnnualSubscriptionSku()}
        highlighted
        onPress={() => setSelectedSku(getPixAiAnnualSubscriptionSku())}
        cardStyle={styles.card}
        planStyle={styles.plan}
        subtitleStyle={styles.subtitle}
        highlightedCardStyle={styles.planCardHighlighted}
        highlightedPlanStyle={styles.planTitleHighlighted}
        selectedCardStyle={styles.planCardSelected}
      />

      <View style={styles.card}>
        {!iapSupported ? (
          <Text style={styles.subtitle}>{t("subscriptionPaywall.expoGoHint")}</Text>
        ) : null}
        <AppPressable
          disabled={!iapSupported || purchasePending || productsLoading || verifying}
          style={styles.cta}
          onPress={() => void handlePurchase()}
        >
          {purchasePending || productsLoading || verifying ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>{purchaseLabel}</Text>
          )}
        </AppPressable>
        {verifying ? (
          <Text style={[styles.legal, { textAlign: "center", marginTop: 6 }]}>
            {t("subscriptionPaywall.purchaseVerifying")}
          </Text>
        ) : null}
        <AppPressable disabled={!iapSupported || restorePending || verifying} style={styles.secondary} onPress={() => void handleRestore()}>
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
        <Text style={styles.legal}>
          {t(Platform.OS === "android" ? "subscriptionPaywall.legalGoogle" : "subscriptionPaywall.legalApple")}
        </Text>
        <Text style={styles.legal}>
          <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(TERMS_URL)}>
            {t("subscriptionPaywall.termsLink")}
          </Text>
          {" · "}
          <Text style={{ color: colors.primary }} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            {t("subscriptionPaywall.privacyLink")}
          </Text>
        </Text>
      </View>
      </ScrollView>
      <SubscriptionPaywallTourModal visible={tourVisible} onClose={closeTour} />
      <SubscriptionPurchaseResultModal
        visible={verificationState.status === "success" || verificationState.status === "error"}
        success={verificationState.status === "success"}
        errorMessage={
          verificationState.status === "error"
            ? t(getSubscriptionErrorTranslationKey(verificationState.code))
            : undefined
        }
        onDismiss={verificationState.status === "success" ? handleSuccessDismiss : handleErrorDismiss}
        onRetry={
          verificationState.status === "error"
            ? () => {
                handleErrorDismiss();
                void handleRestore();
              }
            : undefined
        }
      />
    </>
  );
}
