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
  const hasCreditsBalance = balance > 0 || (creditsError && hasPaidPremium);
  const canUseBookingCredits = exemptFromBookingCredits || hasCreditsBalance;

  const standardPaidBookingAccess = hasCreditsBalance && (isIntroActive || hasPaidPremium);

  const access = useMemo(
    () => ({
      canAccessBookingFlow: exemptFromBookingCredits || standardPaidBookingAccess,
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
    !isLoading && !exemptFromBookingCredits && !access.canAccessBookingFlow && !access.canAccessVibeMatch;

  const bookingSelectionLimit = exemptFromBookingCredits ? Number.MAX_SAFE_INTEGER : balance;

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
    bookingSelectionLimit,
    isLoading,
    needsPaywall,
    introPeriodEndsAt: credits?.introPeriodEndsAt ?? null,
  };
}
