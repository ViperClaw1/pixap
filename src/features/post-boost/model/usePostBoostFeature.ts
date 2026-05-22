import { useBookingAccess } from "@/features/booking-access";

export function usePostBoostFeature() {
  const { hasPostBoostFeature, hasPremiumPlus } = useBookingAccess();

  return {
    enabled: hasPostBoostFeature,
    isImplemented: true,
    hasPremiumPlus,
  };
}
