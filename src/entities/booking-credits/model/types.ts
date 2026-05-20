export type BookingCreditsStatus = {
  balance: number;
  introPeriodEndsAt: string;
  isIntroActive: boolean;
  hasPaidPremium: boolean;
  hasPremiumPlus: boolean;
  activeProductId: string | null;
};
