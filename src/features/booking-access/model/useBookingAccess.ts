import { useMemo } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useBookingCredits } from "@/entities/booking-credits";
import { useEntitlement } from "@/entities/subscription";
import { isPaidPremiumProduct, isPremiumPlusProduct } from "@/entities/subscription/model/productIds";
import { isProfileAdmin, useProfile } from "@/entities/user";

export function useBookingAccess() {
  const { user } = useAuth();
  const { isLoading: entitlementLoading, isError: entitlementError, isActive, entitlement, entitlementHydrated } = useEntitlement();
  const { isLoading: creditsLoading, isError: creditsError, credits, balance } = useBookingCredits();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isProfileAdminUser = isProfileAdmin(profile?.account_role);
  const exemptFromBookingCredits = isProfileAdminUser;

  const activeProductId = credits?.activeProductId ?? entitlement?.product_id ?? null;
  const hasPaidPremium =
    credits?.hasPaidPremium === true ||
    (isActive && isPaidPremiumProduct(entitlement?.product_id));
  const hasPremiumPlus =
    credits?.hasPremiumPlus === true ||
    (isActive && isPremiumPlusProduct(entitlement?.product_id));
  const isIntroActive = credits?.isIntroActive === true;
  // "Credits" now pay for Pix AI concierge (Gemini) turns and route-building (Google Maps)
  // calls, not for bookings themselves — booking a table is always free.
  const hasCreditsBalance = balance > 0 || (creditsError && hasPaidPremium);
  const canUseBookingCredits = exemptFromBookingCredits || hasCreditsBalance;

  const standardPaidBookingAccess = hasCreditsBalance && (isIntroActive || hasPaidPremium);

  const access = useMemo(
    () => ({
      // Bookings are never credit-gated — only AI concierge / route building consume credits.
      canAccessBookingFlow: true,
      canAccessAIBooking: exemptFromBookingCredits || standardPaidBookingAccess,
      canAccessVibeMatch: exemptFromBookingCredits || standardPaidBookingAccess,
      hasPostBoostFeature: exemptFromBookingCredits || hasPremiumPlus,
    }),
    [exemptFromBookingCredits, hasPremiumPlus, standardPaidBookingAccess],
  );

  const isLoading =
    !entitlementHydrated ||
    (entitlementLoading && !entitlementError) ||
    (creditsLoading && !creditsError) ||
    (!!user && profileLoading);

  const needsPaywall =
    !isLoading && !exemptFromBookingCredits && !access.canAccessVibeMatch && !access.canAccessAIBooking;

  return {
    ...access,
    balance,
    credits,
    isIntroActive,
    hasPaidPremium,
    hasPremiumPlus,
    activeProductId,
    canUseBookingCredits,
    isProfileAdmin: isProfileAdminUser,
    exemptFromBookingCredits,
    isLoading,
    needsPaywall,
    introPeriodEndsAt: credits?.introPeriodEndsAt ?? null,
  };
}
