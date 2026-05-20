import { useMemo } from "react";
import { useBookingCredits } from "@/entities/booking-credits";
import { useEntitlement } from "@/entities/subscription";
import { isPaidPremiumProduct, isPremiumPlusProduct } from "@/entities/subscription/model/productIds";

export function useBookingAccess() {
  const { isLoading: entitlementLoading, isActive, entitlement } = useEntitlement();
  const { isLoading: creditsLoading, credits, balance } = useBookingCredits();

  const activeProductId = credits?.activeProductId ?? entitlement?.product_id ?? null;
  const hasPaidPremium =
    credits?.hasPaidPremium === true ||
    (isActive && isPaidPremiumProduct(entitlement?.product_id));
  const hasPremiumPlus =
    credits?.hasPremiumPlus === true ||
    (isActive && isPremiumPlusProduct(entitlement?.product_id));
  const isIntroActive = credits?.isIntroActive === true;
  const canUseBookingCredits = balance > 0;

  const access = useMemo(
    () => ({
      canAccessBookingFlow: canUseBookingCredits && (isIntroActive || hasPaidPremium),
      canAccessAIBooking: canUseBookingCredits && (isIntroActive || hasPaidPremium),
      canAccessVibeMatch: canUseBookingCredits && hasPaidPremium,
      hasPostBoostFeature: hasPremiumPlus,
    }),
    [canUseBookingCredits, hasPaidPremium, hasPremiumPlus, isIntroActive],
  );

  const isLoading = entitlementLoading || creditsLoading;

  const needsPaywall = !isLoading && !access.canAccessBookingFlow && !access.canAccessVibeMatch;

  return {
    ...access,
    balance,
    credits,
    isIntroActive,
    hasPaidPremium,
    hasPremiumPlus,
    activeProductId,
    canUseBookingCredits,
    isLoading,
    needsPaywall,
    introPeriodEndsAt: credits?.introPeriodEndsAt ?? null,
  };
}
